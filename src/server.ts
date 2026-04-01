import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerRunCommand, registerSkills } from './registry.js';
import { scanAllSkills } from './scanner.js';
import type { Skill2McpConfig } from './types.js';

/**
 * 创建 MCP Server 并注册所有 Skill
 */
export function createServer(config: Skill2McpConfig): McpServer {
  const server = new McpServer(
    { name: 'skill2mcp', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  const skills = scanAllSkills(config.skillDirs);
  registerSkills(server, skills, config);
  registerRunCommand(server, config);

  return server;
}

/**
 * 创建 MCP Server 并连接 stdio transport
 */
export async function startServer(config: Skill2McpConfig): Promise<void> {
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
