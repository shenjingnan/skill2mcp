/**
 * skill2mcp - 将 Claude Code Skills 转换为 MCP 服务
 */

export { resolveConfig } from './config.js';
export { executeCommand, executeSkill, substituteVariables } from './executor.js';
export { registerRunCommand, registerSkills } from './registry.js';
export { parseFrontmatter, scanAllSkills, scanSkillDirectory } from './scanner.js';
export { createServer, startServer } from './server.js';
export type {
  CommandResult,
  Skill2McpConfig,
  SkillDefinition,
  SkillFrontmatter,
} from './types.js';
