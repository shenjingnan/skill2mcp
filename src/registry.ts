import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { executeCommand, executeSkill } from './executor.js';
import type { Skill2McpConfig, SkillDefinition } from './types.js';

/**
 * 将 Skill 名称转换为合法的 MCP tool 名称
 * 规则：小写，空格/特殊字符替换为连字符
 */
function toToolName(skillName: string): string {
  return skillName
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * 注册所有 Skill 为独立的 MCP tool
 */
export function registerSkills(
  server: McpServer,
  skills: SkillDefinition[],
  config: Skill2McpConfig
): void {
  for (const skill of skills) {
    const toolName = toToolName(skill.name);
    const description = skill.frontmatter.description ?? `Execute the "${skill.name}" skill`;

    // 构建描述，附加元信息
    let fullDescription = description;
    if (skill.frontmatter.when_to_use) {
      fullDescription += `\n\nWhen to use: ${skill.frontmatter.when_to_use}`;
    }
    if (skill.frontmatter['argument-hint']) {
      fullDescription += `\n\nArguments: ${skill.frontmatter['argument-hint']}`;
    }

    const schema = {
      args: z
        .string()
        .optional()
        .describe(skill.frontmatter['argument-hint'] ?? 'Arguments to pass to the skill'),
    };

    server.tool(toolName, fullDescription, schema, async ({ args }) => {
      try {
        const result = await executeSkill(skill, args ?? '', config);
        return {
          content: [{ type: 'text' as const, text: result }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    });
  }
}

/**
 * 注册通用的 run_command tool（可通过配置禁用）
 */
export function registerRunCommand(server: McpServer, config: Skill2McpConfig): void {
  if (!config.enableRunCommand) {
    return;
  }

  server.tool(
    'run_command',
    'Execute a CLI command on the local machine. Use with caution.',
    {
      command: z.string().describe('The CLI command to execute'),
      cwd: z.string().optional().describe('Working directory (defaults to project root)'),
    },
    async ({ command, cwd }) => {
      try {
        const result = await executeCommand(
          command,
          cwd ?? config.workingDirectory,
          config.commandTimeout
        );
        const output = result.stdout || result.stderr;
        const text = result.exitCode === 0 ? output : `Exit code: ${result.exitCode}\n${output}`;
        return {
          content: [{ type: 'text' as const, text }],
          ...(result.exitCode !== 0 ? { isError: true } : {}),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
