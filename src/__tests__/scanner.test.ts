import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter, scanAllSkills, scanSkillDirectory } from '../scanner.js';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

describe('parseFrontmatter', () => {
  it('should parse frontmatter with description', () => {
    const content = `---
description: A simple greeting skill
when_to_use: Use when you need to greet someone
---

# Hello Skill

Some content.`;

    const { frontmatter, body } = parseFrontmatter(content);
    expect(frontmatter.description).toBe('A simple greeting skill');
    expect(frontmatter.when_to_use).toBe('Use when you need to greet someone');
    expect(body).toContain('# Hello Skill');
  });

  it('should handle content without frontmatter', () => {
    const content = '# No Frontmatter\n\nJust content.';
    const { frontmatter, body } = parseFrontmatter(content);
    expect(frontmatter).toEqual({});
    expect(body).toBe(content);
  });

  it('should parse argument-hint', () => {
    const content = `---
description: Run a test
argument-hint: "<test-file>"
---

Body`;
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.description).toBe('Run a test');
    expect(frontmatter['argument-hint']).toBe('<test-file>');
  });

  it('should parse shell field', () => {
    const content = `---
description: Build
shell: bash
---

Body`;
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.shell).toBe('bash');
  });

  it('should skip null values', () => {
    const content = `---
description: Test
when_to_use: null
---

Body`;
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.description).toBe('Test');
    expect(frontmatter.when_to_use).toBeUndefined();
  });

  it('should handle quoted values', () => {
    const content = `---
description: "A quoted description"
---

Body`;
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.description).toBe('A quoted description');
  });

  it('should handle single quoted values', () => {
    const content = `---
description: 'Single quoted'
---

Body`;
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.description).toBe('Single quoted');
  });

  it('should skip comments', () => {
    const content = `---
# This is a comment
description: Real value
---

Body`;
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.description).toBe('Real value');
  });

  it('should handle empty frontmatter', () => {
    const content = `---
---

Body`;
    const { frontmatter, body } = parseFrontmatter(content);
    expect(frontmatter).toEqual({});
    expect(body.trim()).toBe('Body');
  });

  it('should handle allowed-tools array', () => {
    const content = `---
description: Test
allowed-tools: [tool1, tool2]
---

Body`;
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter['allowed-tools']).toEqual(['tool1', 'tool2']);
  });
});

describe('scanSkillDirectory', () => {
  it('should scan fixtures directory and find skills', () => {
    const skills = scanSkillDirectory(FIXTURES_DIR);
    expect(skills.length).toBeGreaterThanOrEqual(3);

    const names = skills.map((s) => s.name);
    expect(names).toContain('hello-skill');
    expect(names).toContain('build-skill');
    expect(names).toContain('skill-with-args');
  });

  it('should parse skill frontmatter correctly', () => {
    const skills = scanSkillDirectory(FIXTURES_DIR);
    const hello = skills.find((s) => s.name === 'hello-skill');
    expect(hello).toBeDefined();
    expect(hello?.frontmatter.description).toBe('A simple greeting skill');
    expect(hello?.body).toContain('# Hello Skill');
  });

  it('should return empty array for non-existent directory', () => {
    const skills = scanSkillDirectory('/non/existent/path');
    expect(skills).toEqual([]);
  });

  it('should handle build-skill with shell field', () => {
    const skills = scanSkillDirectory(FIXTURES_DIR);
    const build = skills.find((s) => s.name === 'build-skill');
    expect(build).toBeDefined();
    expect(build?.frontmatter.shell).toBe('bash');
  });

  it('should handle skill-with-args with argument-hint', () => {
    const skills = scanSkillDirectory(FIXTURES_DIR);
    const withArgs = skills.find((s) => s.name === 'skill-with-args');
    expect(withArgs).toBeDefined();
    expect(withArgs?.frontmatter['argument-hint']).toBe('<test-file>');
  });
});

describe('scanAllSkills', () => {
  it('should merge skills from multiple directories', () => {
    const skills = scanAllSkills([FIXTURES_DIR]);
    expect(skills.length).toBeGreaterThanOrEqual(3);
  });

  it('should deduplicate skills by filePath', () => {
    const skills = scanAllSkills([FIXTURES_DIR, FIXTURES_DIR]);
    // 不应该重复
    const names = skills.map((s) => s.name);
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });

  it('should skip non-existent directories', () => {
    const skills = scanAllSkills(['/non/existent']);
    expect(skills).toEqual([]);
  });
});
