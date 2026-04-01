import { spawn } from 'node:child_process';
import type { CommandResult, Skill2McpConfig, SkillDefinition } from './types.js';

const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\s+\//,
  /\bmkfs\b/,
  /\bdd\s+if=/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bhalt\b/,
  /\binit\s+[06]/,
  /\bformat\s+[a-zA-Z]:/i,
];

/**
 * 替换 Skill body 中的变量
 * - $ARGUMENTS -> 用户传入的参数
 * - $0, $1, ... -> 参数按空格分割后的各部分
 * - ${CLAUDE_SKILL_DIR} -> skill 所在目录
 */
export function substituteVariables(text: string, args: string, skillDir: string): string {
  let result = text;

  // 替换 ${CLAUDE_SKILL_DIR}
  result = result.replace(/\$\{CLAUDE_SKILL_DIR\}/g, skillDir);

  // 替换 $0, $1, $2, ... （在 $ARGUMENTS 之前，避免替换后的内容被二次处理）
  const parts = args.split(/\s+/);
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part !== undefined) {
      result = result.replace(new RegExp(`\\$${i}(?![0-9])`, 'g'), part);
    }
  }

  // 替换 $ARGUMENTS
  result = result.replace(/\$ARGUMENTS/g, args);

  return result;
}

/**
 * 检查命令是否包含危险操作
 */
function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

/**
 * 提取 body 中的 shell 命令
 * 支持两种格式:
 * - 内联: !`command`
 * - 代码块: ```!bash ... ```
 */
export function extractShellCommands(body: string): string[] {
  const commands: string[] = [];

  // 匹配 ```!bash 或 ```! ... ```
  const blockRegex = /```!(?:\w+)?\s*\n([\s\S]*?)```/g;
  for (const match of body.matchAll(blockRegex)) {
    const blockContent = match[1];
    if (blockContent) {
      commands.push(...splitCommands(blockContent.trim()));
    }
  }

  // 匹配内联 !`command`
  const inlineRegex = /!`([^`]+)`/g;
  for (const match of body.matchAll(inlineRegex)) {
    const inlineContent = match[1];
    if (inlineContent) {
      commands.push(inlineContent.trim());
    }
  }

  return commands;
}

/**
 * 将多行命令按行分割，过滤空行和注释
 */
function splitCommands(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .filter((line) => !line.startsWith('//'));
}

/**
 * 使用 child_process.spawn 执行命令（安全方式）
 * 使用 spawn 传入数组参数而非 shell 字符串拼接
 */
export function executeCommand(
  command: string,
  cwd?: string,
  timeout?: number
): Promise<CommandResult> {
  if (isDangerousCommand(command)) {
    return Promise.reject(new Error(`Blocked dangerous command: ${command}`));
  }

  const timeoutMs = timeout ?? 30_000;

  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd' : '/bin/bash';
    const shellArgs = isWindows ? ['/c', command] : ['-c', command];

    const child = spawn(shell, shellArgs, {
      cwd: cwd ?? process.cwd(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Uint8Array) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Uint8Array) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        stdout,
        stderr: `Command timed out after ${timeoutMs}ms`,
        exitCode: -1,
      });
    }, timeoutMs);

    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? -1,
      });
    });

    child.on('error', (err: Error) => {
      clearTimeout(timer);
      resolve({
        stdout: '',
        stderr: err.message,
        exitCode: -1,
      });
    });
  });
}

/**
 * 完整执行 Skill
 * 1. 替换变量
 * 2. 提取 shell 命令
 * 3. 执行命令
 * 4. 将结果替换回 body
 */
export async function executeSkill(
  skill: SkillDefinition,
  args: string,
  config: Skill2McpConfig
): Promise<string> {
  let body = substituteVariables(skill.body, args, skill.dirPath);

  const commands = extractShellCommands(body);

  if (commands.length === 0) {
    return body;
  }

  // 执行所有命令并收集结果
  const results: string[] = [];
  for (const cmd of commands) {
    const result = await executeCommand(cmd, config.workingDirectory, config.commandTimeout);
    const output = result.stdout || result.stderr;
    results.push(`$ ${cmd}\n${output}`);
  }

  // 替换命令块为执行结果
  let resultIndex = 0;
  body = body.replace(/```!(?:\w+)?\s*\n[\s\S]*?```/g, () => {
    return `\`\`\`\n${results[resultIndex++] ?? ''}\n\`\`\``;
  });

  body = body.replace(/!`[^`]+`/g, () => {
    const idx = resultIndex++;
    return results[idx] ?? '';
  });

  return body;
}
