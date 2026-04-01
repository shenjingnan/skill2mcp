import { describe, expect, it } from 'vitest';
import { registerRunCommand, registerSkills } from '../registry.js';
import type { Skill2McpConfig, SkillDefinition } from '../types.js';

function createMockServer() {
  const tools: Array<{
    name: string;
    description: string;
    schema: Record<string, unknown>;
    handler: (...args: unknown[]) => Promise<unknown>;
  }> = [];

  return {
    tools,
    server: {
      tool(
        name: string,
        description: string,
        schema: Record<string, unknown>,
        handler: (...args: unknown[]) => Promise<unknown>
      ) {
        tools.push({ name, description, schema, handler });
      },
    } as unknown,
  };
}

const mockConfig: Skill2McpConfig = {
  skillDirs: [],
  commandTimeout: 5000,
  enableRunCommand: true,
  workingDirectory: process.cwd(),
};

describe('registerSkills', () => {
  it('should register each skill as a tool', () => {
    const { server, tools } = createMockServer();
    const skills: SkillDefinition[] = [
      {
        name: 'build',
        dirPath: '/skills/build',
        filePath: '/skills/build/SKILL.md',
        frontmatter: { description: 'Build the project' },
        body: '# Build\n\nBuild it.',
      },
      {
        name: 'test',
        dirPath: '/skills/test',
        filePath: '/skills/test/SKILL.md',
        frontmatter: { description: 'Run tests' },
        body: '# Test\n\nTest it.',
      },
    ];

    registerSkills(server as never, skills, mockConfig);
    expect(tools).toHaveLength(2);
    expect(tools[0]?.name).toBe('build');
    expect(tools[1]?.name).toBe('test');
  });

  it('should include when_to_use in description', () => {
    const { server, tools } = createMockServer();
    const skills: SkillDefinition[] = [
      {
        name: 'lint',
        dirPath: '/skills/lint',
        filePath: '/skills/lint/SKILL.md',
        frontmatter: {
          description: 'Lint code',
          when_to_use: 'Use when checking code quality',
        },
        body: '# Lint',
      },
    ];

    registerSkills(server as never, skills, mockConfig);
    expect(tools[0]?.description).toContain('When to use: Use when checking code quality');
  });

  it('should sanitize tool names', () => {
    const { server, tools } = createMockServer();
    const skills: SkillDefinition[] = [
      {
        name: 'My Complex Skill',
        dirPath: '/skills/my-complex-skill',
        filePath: '/skills/my-complex-skill/SKILL.md',
        frontmatter: {},
        body: '# Skill',
      },
    ];

    registerSkills(server as never, skills, mockConfig);
    expect(tools[0]?.name).toBe('my-complex-skill');
  });

  it('should execute skill when handler is called', async () => {
    const { server, tools } = createMockServer();
    const skills: SkillDefinition[] = [
      {
        name: 'echo-skill',
        dirPath: '/skills/echo',
        filePath: '/skills/echo/SKILL.md',
        frontmatter: {},
        body: 'Hello $ARGUMENTS',
      },
    ];

    registerSkills(server as never, skills, mockConfig);
    const handler = tools[0]?.handler;
    const result = await handler?.({ args: 'world' });
    expect(result).toBeDefined();
  });
});

describe('registerRunCommand', () => {
  it('should register run_command when enabled', () => {
    const { server, tools } = createMockServer();
    registerRunCommand(server as never, mockConfig);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('run_command');
  });

  it('should not register run_command when disabled', () => {
    const { server, tools } = createMockServer();
    const config = { ...mockConfig, enableRunCommand: false };
    registerRunCommand(server as never, config);
    expect(tools).toHaveLength(0);
  });
});
