import * as fs from 'node:fs';
import * as path from 'pathe';

/**
 * Markdown 文件结构
 */
export interface MarkdownFile {
  path: string;
  attributes: Record<string, any>;
  body: string;
}

/**
 * 标准化的 Markdown 文件
 */
export interface NormalizedMarkdownFile extends MarkdownFile {
  name: string;
  description: string;
  relativePath: string;
}

/**
 * 解析 frontmatter
 *
 * 支持格式:
 * ---
 * key: value
 * ---
 * content
 */
export function parseFrontMatter(content: string): {
  attributes: Record<string, any>;
  body: string;
} {
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontMatterRegex);

  if (!match) {
    return {
      attributes: {},
      body: content,
    };
  }

  const [, frontMatter, body] = match;
  const attributes: Record<string, any> = {};

  // 解析 YAML 格式的 frontmatter
  const lines = frontMatter.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      // 处理布尔值
      if (value === 'true') {
        attributes[key] = true;
      } else if (value === 'false') {
        attributes[key] = false;
      } else {
        attributes[key] = value;
      }
    }
  }

  return {
    attributes,
    body: body.trim(),
  };
}

/**
 * 加载 Markdown 文件
 */
export function loadMarkdownFile(filePath: string): MarkdownFile {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Markdown file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const { attributes, body } = parseFrontMatter(content);

  return {
    path: filePath,
    attributes,
    body,
  };
}

/**
 * 加载并标准化 Markdown 文件
 */
export function loadNormalizedMarkdownFile(
  filePath: string,
  baseDir?: string
): NormalizedMarkdownFile {
  const file = loadMarkdownFile(filePath);

  // 生成名称
  let name = path.basename(filePath, '.md');
  if (baseDir) {
    const relativePath = path.relative(baseDir, filePath);
    // 将路径转换为名称 (例如: styles/custom.md -> styles:custom)
    name = relativePath.replace(/\.md$/, '').replace(/[/\\]/g, ':');
  }

  // 生成描述
  let description = file.attributes.description?.trim();
  if (!description) {
    // 从文件内容的第一行提取描述
    const lines = file.body.split('\n');
    const firstLine = lines.find((line) => line.trim())?.trim();
    if (firstLine) {
      if (firstLine.startsWith('#')) {
        description = firstLine.replace(/^#+\s*/, '').trim();
      } else {
        description = firstLine;
      }
      // 限制长度
      if (description.length > 50) {
        description = `${description.substring(0, 50)}...`;
      }
    }
  }
  if (!description) {
    description = name;
  }

  return {
    ...file,
    name,
    description,
    relativePath: filePath,
  };
}

/**
 * 加载目录下的所有 Markdown 文件
 */
export function loadMarkdownFiles(dir: string): NormalizedMarkdownFile[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files: NormalizedMarkdownFile[] = [];

  function scanDir(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const file = loadNormalizedMarkdownFile(fullPath, dir);
          files.push(file);
        } catch (error) {
          console.error(`Failed to load ${fullPath}:`, error);
        }
      }
    }
  }

  scanDir(dir);
  return files;
}
