import { describe, expect, it, vi } from 'vitest';
import type { Skill2McpConfig } from '../types.js';

const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockTool = vi.fn();
const mockServer = { connect: mockConnect, tool: mockTool };

vi.mock('../scanner.js', () => ({
  scanAllSkills: vi.fn().mockReturnValue([
    {
      name: 'test-skill',
      dirPath: '/skills/test',
      filePath: '/skills/test/SKILL.md',
      frontmatter: { description: 'Test skill' },
      body: 'Hello $ARGUMENTS',
    },
  ]),
}));

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockReturnValue(mockServer),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockReturnValue({}),
}));

const mockConfig: Skill2McpConfig = {
  skillDirs: ['/fake/skills'],
  commandTimeout: 5000,
  enableRunCommand: true,
  workingDirectory: process.cwd(),
};

describe('createServer', () => {
  it('should create an MCP server with tools registered', async () => {
    const { createServer } = await import('../server.js');
    const server = createServer(mockConfig);
    expect(server).toBeDefined();
    expect(server).toBe(mockServer);
  });

  it('should call scanAllSkills with configured directories', async () => {
    const { createServer } = await import('../server.js');
    const { scanAllSkills } = await import('../scanner.js');
    createServer(mockConfig);
    expect(scanAllSkills).toHaveBeenCalledWith(mockConfig.skillDirs);
  });
});

describe('startServer', () => {
  it('should create server and connect transport', async () => {
    const { startServer } = await import('../server.js');
    await startServer(mockConfig);
    expect(mockConnect).toHaveBeenCalled();
  });
});
