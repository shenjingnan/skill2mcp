/**
 * skill2mcp 核心类型定义
 */

/** Skill frontmatter 元数据 */
export interface SkillFrontmatter {
  /** Skill 描述 */
  description?: string;
  /** 参数提示，如 "<file-path>" */
  'argument-hint'?: string;
  /** 使用场景说明 */
  when_to_use?: string;
  /** Shell 类型 */
  shell?: string;
  /** 允许的工具列表 */
  'allowed-tools'?: string[];
}

/** 解析后的完整 Skill 定义 */
export interface SkillDefinition {
  /** Skill 名称（来自目录名或文件名） */
  name: string;
  /** Skill 所在目录的绝对路径 */
  dirPath: string;
  /** SKILL.md 文件的绝对路径 */
  filePath: string;
  /** Frontmatter 元数据 */
  frontmatter: SkillFrontmatter;
  /** Markdown 正文内容 */
  body: string;
}

/** skill2mcp 配置 */
export interface Skill2McpConfig {
  /** Skill 搜索目录列表 */
  skillDirs: string[];
  /** 命令执行超时时间（毫秒） */
  commandTimeout: number;
  /** 是否启用通用 run_command tool */
  enableRunCommand: boolean;
  /** 工作目录 */
  workingDirectory: string;
}

/** 命令执行结果 */
export interface CommandResult {
  /** 标准输出 */
  stdout: string;
  /** 标准错误 */
  stderr: string;
  /** 退出码 */
  exitCode: number;
}
