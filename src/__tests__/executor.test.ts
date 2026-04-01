import { describe, expect, it } from 'vitest';
import { executeCommand, extractShellCommands, substituteVariables } from '../executor.js';

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
});
