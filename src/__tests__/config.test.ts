import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveConfig } from '../config.js';

describe('resolveConfig', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // 保存环境变量
    for (const key of [
      'SKILL2MCP_SKILL_DIRS',
      'SKILL2MCP_TIMEOUT',
      'SKILL2MCP_WORKDIR',
      'SKILL2MCP_ENABLE_RUN_COMMAND',
    ]) {
      originalEnv[key] = process.env[key];
    }
  });

  afterEach(() => {
    // 恢复环境变量
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        process.env[key] = undefined as unknown as string;
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('should return default config', () => {
    const config = resolveConfig();
    expect(config.commandTimeout).toBe(30_000);
    expect(config.enableRunCommand).toBe(true);
    expect(config.skillDirs.length).toBe(2);
    // skillDirs 应该被解析为绝对路径
    for (const dir of config.skillDirs) {
      expect(path.isAbsolute(dir)).toBe(true);
    }
  });

  it('should resolve skillDirs from env', () => {
    process.env.SKILL2MCP_SKILL_DIRS = '/a:/b:/c';
    const config = resolveConfig();
    expect(config.skillDirs).toEqual(['/a', '/b', '/c']);
  });

  it('should resolve timeout from env', () => {
    process.env.SKILL2MCP_TIMEOUT = '60000';
    const config = resolveConfig();
    expect(config.commandTimeout).toBe(60_000);
  });

  it('should ignore invalid timeout', () => {
    process.env.SKILL2MCP_TIMEOUT = 'not-a-number';
    const config = resolveConfig();
    expect(config.commandTimeout).toBe(30_000);
  });

  it('should resolve workdir from env', () => {
    process.env.SKILL2MCP_WORKDIR = '/tmp/test';
    const config = resolveConfig();
    expect(config.workingDirectory).toBe('/tmp/test');
  });

  it('should resolve enableRunCommand from env', () => {
    process.env.SKILL2MCP_ENABLE_RUN_COMMAND = 'false';
    const config = resolveConfig();
    expect(config.enableRunCommand).toBe(false);

    process.env.SKILL2MCP_ENABLE_RUN_COMMAND = 'true';
    const config2 = resolveConfig();
    expect(config2.enableRunCommand).toBe(true);
  });

  it('should apply overrides', () => {
    const config = resolveConfig({ commandTimeout: 5000, enableRunCommand: false });
    expect(config.commandTimeout).toBe(5000);
    expect(config.enableRunCommand).toBe(false);
  });

  it('should convert relative skillDirs to absolute paths', () => {
    const config = resolveConfig({ skillDirs: ['.skills'] });
    expect(config.skillDirs[0]).toBe(path.resolve(process.cwd(), '.skills'));
  });
});
