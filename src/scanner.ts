import fs from 'node:fs';
import path from 'node:path';
import type { SkillDefinition, SkillFrontmatter } from './types.js';

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n?---\s*\n?/;

/**
 * 解析 YAML frontmatter
 * 简单的 key-value 解析，不引入外部 YAML 库
 */
export function parseFrontmatter(content: string): {
  frontmatter: SkillFrontmatter;
  body: string;
} {
  const match = FRONTMATTER_REGEX.exec(content);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const yamlText = match[1];
  const body = content.slice(match[0].length);
  const frontmatter: SkillFrontmatter = {};

  if (yamlText) {
    for (const line of yamlText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;

      const key = trimmed.slice(0, colonIdx).trim();
      let value: string | undefined = trimmed.slice(colonIdx + 1).trim();

      if (!value) {
        continue;
      }

      // 去掉引号
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (value === 'null' || value === '~') {
        continue;
      }

      // 数组类型支持（逗号分隔）
      if (key === 'allowed-tools' && value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/['"]/g, ''))
          .filter(Boolean);
        continue;
      }

      // 已知字段映射
      if (
        key === 'description' ||
        key === 'argument-hint' ||
        key === 'when_to_use' ||
        key === 'shell'
      ) {
        (frontmatter as Record<string, string>)[key] = value;
      } else if (key === 'allowed-tools') {
        // 单个值
        frontmatter['allowed-tools'] = [value];
      }
    }
  }

  return { frontmatter, body };
}

/**
 * 扫描单个目录，查找所有 Skill
 * 支持 skills/ 目录下的 skill-name/SKILL.md 格式
 * 支持 commands/ 目录下的 command-name.md 格式（legacy）
 */
export function scanSkillDirectory(dirPath: string): SkillDefinition[] {
  const skills: SkillDefinition[] = [];

  if (!fs.existsSync(dirPath)) {
    return skills;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return skills;
  }

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // skills/ 目录格式: skill-name/SKILL.md
      const skillFile = path.join(entryPath, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        const skill = parseSkillFile(skillFile, entryPath, entry.name);
        if (skill) skills.push(skill);
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // commands/ 目录格式: command-name.md
      const name = entry.name.replace(/\.md$/, '');
      const skill = parseSkillFile(entryPath, path.dirname(entryPath), name);
      if (skill) skills.push(skill);
    }
  }

  return skills;
}

/**
 * 解析单个 Skill 文件
 */
function parseSkillFile(filePath: string, dirPath: string, name: string): SkillDefinition | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);
    return {
      name,
      dirPath,
      filePath,
      frontmatter,
      body,
    };
  } catch {
    return null;
  }
}

/**
 * 扫描所有目录，合并结果并去重
 */
export function scanAllSkills(dirPaths: string[]): SkillDefinition[] {
  const seen = new Set<string>();
  const skills: SkillDefinition[] = [];

  for (const dirPath of dirPaths) {
    for (const skill of scanSkillDirectory(dirPath)) {
      // 基于 filePath 去重
      if (!seen.has(skill.filePath)) {
        seen.add(skill.filePath);
        skills.push(skill);
      }
    }
  }

  return skills;
}
