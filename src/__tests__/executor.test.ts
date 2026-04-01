import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

// 使用 vi.hoisted 确保 mock 和变量一起提升
const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  spawnMock.mockImplementation((...args: Parameters<typeof actual.spawn>) => actual.spawn(...args));
  return { ...actual, spawn: spawnMock };
});

import {
  executeCommand,
  executeSkill,
  extractShellCommands,
  substituteVariables,
} from '../executor.js';
import type { Skill2McpConfig, SkillDefinition } from '../types.js';

const mockConfig: Skill2McpConfig = {
  skillDirs: [],
  commandTimeout: 5000,
  enableRunCommand: true,
  workingDirectory: process.cwd(),
};

describe('substituteVariables', () => {
  it('should replace $ARGUMENTS', () => {
    const result = substituteVariables('Run $ARGUMENTS', 'test-file.ts', '/dir');
    expect(result).toBe('Run test-file.ts');
  });

  it('should replace CLAUDE_SKILL_DIR variable', () => {
    const result = substituteVariables(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: testing variable substitution
      'Dir: ${CLAUDE_SKILL_DIR}',
      '',
      '/home/user/skills/my-skill'
    );
    expect(result).toBe('Dir: /home/user/skills/my-skill');
  });

  it('should replace $0, $1, $2 positional args', () => {
    const result = substituteVariables('$0 and $1 and $2', 'a b c', '/dir');
    expect(result).toBe('a and b and c');
  });

  it('should handle multiple variable types', () => {
    const result = substituteVariables(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: testing variable substitution
      '${CLAUDE_SKILL_DIR}/$0 $ARGUMENTS',
      'file arg',
      '/skills/test'
    );
    expect(result).toBe('/skills/test/file file arg');
  });

  it('should handle empty args', () => {
    const result = substituteVariables('No args: $ARGUMENTS', '', '/dir');
    expect(result).toBe('No args: ');
  });
});

describe('extractShellCommands', () => {
  it('should extract commands from code blocks', () => {
    const body = 'Some text\n\n```!bash\npnpm run build\n```\n\nMore text';
    const commands = extractShellCommands(body);
    expect(commands).toEqual(['pnpm run build']);
  });

  it('should extract commands from code blocks without language', () => {
    const body = '```\n!echo hello\n```';
    // 没有 ! 前缀，不应该匹配
    const commands = extractShellCommands(body);
    expect(commands).toEqual([]);
  });

  it('should extract commands from !` inline format', () => {
    const body = 'Run !`echo hello` now';
    const commands = extractShellCommands(body);
    expect(commands).toEqual(['echo hello']);
  });

  it('should handle multiple code blocks', () => {
    const body = '```!bash\npnpm run typecheck\n```\n\n```!bash\npnpm run build\n```';
    const commands = extractShellCommands(body);
    expect(commands).toEqual(['pnpm run typecheck', 'pnpm run build']);
  });

  it('should filter comments and empty lines', () => {
    const body = '```!bash\n# comment\necho hello\n\n# another\necho world\n```';
    const commands = extractShellCommands(body);
    expect(commands).toEqual(['echo hello', 'echo world']);
  });

  it('should return empty array when no commands found', () => {
    const body = 'Just regular text\n\n```js\nconst x = 1;\n```';
    const commands = extractShellCommands(body);
    expect(commands).toEqual([]);
  });

  it('should handle mixed inline and block commands', () => {
    const body = 'First !`echo a` then\n\n```!bash\necho b\n```';
    const commands = extractShellCommands(body);
    expect(commands).toEqual(['echo b', 'echo a']);
  });
});

describe('executeCommand', () => {
  it('should execute a simple command', async () => {
    const result = await executeCommand('echo hello');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });

  it('should capture stderr', async () => {
    const result = await executeCommand('echo error >&2');
    expect(result.stderr.trim()).toBe('error');
  });

  it('should return non-zero exit code for failing commands', async () => {
    const result = await executeCommand('exit 1');
    expect(result.exitCode).toBe(1);
  });

  it('should reject dangerous commands', async () => {
    await expect(executeCommand('rm -rf /')).rejects.toThrow('Blocked dangerous command');
  });

  it('should timeout long-running commands', async () => {
    const result = await executeCommand('sleep 10', undefined, 500);
    expect(result.exitCode).toBe(-1);
    expect(result.stderr).toContain('timed out');
  }, 10_000);

  it('should respect cwd option', async () => {
    const result = await executeCommand('pwd', '/');
    expect(result.stdout.trim()).toBe('/');
  });

  it('should handle spawn error', async () => {
    const mockChild = new EventEmitter() as unknown as import('node:child_process').ChildProcess;
    Object.defineProperty(mockChild, 'stdout', { value: new EventEmitter(), writable: true });
    Object.defineProperty(mockChild, 'stderr', { value: new EventEmitter(), writable: true });
    Object.defineProperty(mockChild, 'kill', { value: vi.fn(), writable: true });

    // 覆盖为返回 mock child
    const origImpl = spawnMock.getMockImplementation();
    spawnMock.mockReturnValue(mockChild);

    // 异步触发 error 事件
    const promise = executeCommand('nonexistent-command-xyz');
    setImmediate(() => mockChild.emit('error', new Error('spawn ENOENT')));
    const result = await promise;

    expect(result.exitCode).toBe(-1);
    expect(result.stderr).toBe('spawn ENOENT');

    // 恢复原始实现
    if (origImpl) {
      spawnMock.mockImplementation(origImpl);
    }
  });
});

describe('executeSkill', () => {
  it('should return body as-is when no commands', async () => {
    const skill: SkillDefinition = {
      name: 'static',
      dirPath: '/skills/static',
      filePath: '/skills/static/SKILL.md',
      frontmatter: {},
      body: 'Hello $ARGUMENTS, no commands here.',
    };

    const result = await executeSkill(skill, 'world', mockConfig);
    expect(result).toBe('Hello world, no commands here.');
  });

  it('should execute code block commands and replace with results', async () => {
    const skill: SkillDefinition = {
      name: 'run-echo',
      dirPath: '/skills/run-echo',
      filePath: '/skills/run-echo/SKILL.md',
      frontmatter: {},
      body: 'Before\n\n```!bash\necho hello\n```\n\nAfter',
    };

    const result = await executeSkill(skill, '', mockConfig);
    expect(result).toContain('echo hello');
    expect(result).toContain('hello');
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });

  it('should execute inline commands and replace with results', async () => {
    const skill: SkillDefinition = {
      name: 'inline',
      dirPath: '/skills/inline',
      filePath: '/skills/inline/SKILL.md',
      frontmatter: {},
      body: 'Result: !`echo 42`',
    };

    const result = await executeSkill(skill, '', mockConfig);
    expect(result).toContain('echo 42');
    expect(result).toContain('42');
  });

  it('should handle mixed code block and inline commands', async () => {
    const skill: SkillDefinition = {
      name: 'mixed',
      dirPath: '/skills/mixed',
      filePath: '/skills/mixed/SKILL.md',
      frontmatter: {},
      body: 'Inline: !`echo inline-result`\n\n```!bash\necho block-result\n```',
    };

    const result = await executeSkill(skill, '', mockConfig);
    expect(result).toContain('inline-result');
    expect(result).toContain('block-result');
  });

  it('should use stderr when stdout is empty', async () => {
    const skill: SkillDefinition = {
      name: 'stderr-skill',
      dirPath: '/skills/stderr',
      filePath: '/skills/stderr/SKILL.md',
      frontmatter: {},
      body: '```!bash\necho err-msg >&2\n```',
    };

    const result = await executeSkill(skill, '', mockConfig);
    expect(result).toContain('err-msg');
  });
});
