import path from 'node:path';
import type { Skill2McpConfig } from './types.js';

const DEFAULT_CONFIG: Skill2McpConfig = {
  skillDirs: ['.claude/skills', '.claude/commands'],
  commandTimeout: 30_000,
  enableRunCommand: true,
  workingDirectory: process.cwd(),
};

/**
 * 从环境变量 + 默认值合并配置
 */
export function resolveConfig(overrides?: Partial<Skill2McpConfig>): Skill2McpConfig {
  const envSkillDirs = process.env.SKILL2MCP_SKILL_DIRS;
  const envTimeout = process.env.SKILL2MCP_TIMEOUT;
  const envWorkdir = process.env.SKILL2MCP_WORKDIR;
  const envEnableRun = process.env.SKILL2MCP_ENABLE_RUN_COMMAND;

  let skillDirs = DEFAULT_CONFIG.skillDirs;
  if (envSkillDirs) {
    skillDirs = envSkillDirs.split(':').filter(Boolean);
  }

  let commandTimeout = DEFAULT_CONFIG.commandTimeout;
  if (envTimeout) {
    const parsed = Number.parseInt(envTimeout, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      commandTimeout = parsed;
    }
  }

  let workingDirectory = DEFAULT_CONFIG.workingDirectory;
  if (envWorkdir) {
    workingDirectory = path.resolve(envWorkdir);
  }

  let enableRunCommand = DEFAULT_CONFIG.enableRunCommand;
  if (envEnableRun !== undefined) {
    enableRunCommand = envEnableRun === 'true' || envEnableRun === '1';
  }

  // 将相对路径转为绝对路径
  const absoluteSkillDirs = skillDirs.map((dir) =>
    path.isAbsolute(dir) ? dir : path.resolve(workingDirectory, dir)
  );

  const merged: Skill2McpConfig = {
    skillDirs: absoluteSkillDirs,
    commandTimeout,
    enableRunCommand,
    workingDirectory,
    ...overrides,
  };

  // 确保 overrides 中的 skillDirs 也是绝对路径
  merged.skillDirs = merged.skillDirs.map((dir) =>
    path.isAbsolute(dir) ? dir : path.resolve(merged.workingDirectory, dir)
  );

  return merged;
}
