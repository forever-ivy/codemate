import * as fs from 'node:fs';
import { parse } from '@babel/parser';
import * as path from 'pathe';
import type { RepoMapFile } from './RepoMapService';

type AstNode = Record<string, unknown> & { type?: string };

export type CodeGraphImportKind = 'static' | 're-export' | 'require';

export interface CodeGraphImport {
  source: string;
  imported: string[];
  kind: CodeGraphImportKind;
}

export interface CodeGraphSymbol {
  name: string;
  kind: string;
  exported: boolean;
}

export interface CodeGraphFile {
  path: string;
  imports: CodeGraphImport[];
  exports: string[];
  symbols: CodeGraphSymbol[];
  internalDependencies: string[];
  parseError?: string;
}

export interface CodeGraphEdge {
  from: string;
  to: string;
}

export interface CodeGraph {
  generatedAt: number;
  fileCount: number;
  files: CodeGraphFile[];
  edges: CodeGraphEdge[];
  parseErrors: Array<{ path: string; error: string }>;
}

export interface CodeGraphOptions {
  maxFiles?: number;
  maxBytesPerFile?: number;
  maxImportsPerFile?: number;
  maxSymbolsPerFile?: number;
  supportedExtensions?: string[];
}

/**
 * CodeGraphService 为 RepoMap 增加轻量 AST / Import Graph 信息。
 *
 * 调用链路：
 * RepoMapService.build -> CodeGraphService.build -> RepoMap.codeGraph -> formatForPrompt
 *
 * 本章只分析 TypeScript / JavaScript 文件的顶层结构。
 * 它不会做类型检查，也不会解析完整跨包 module resolution。
 */
export class CodeGraphService {
  private supportedExtensions: Set<string>;

  constructor(
    private cwd: string,
    private options: CodeGraphOptions = {}
  ) {
    this.supportedExtensions = new Set(
      options.supportedExtensions ?? ['.ts', '.tsx', '.js', '.jsx']
    );
  }

  /**
   * 根据 RepoMap 扫描出的文件列表构建结构图。
   */
  build(files: RepoMapFile[]): CodeGraph {
    // 1. 只分析源码类扩展名，并限制数量，避免大仓库扫描阶段变慢。
    const candidates = files
      .filter((file) => this.supportedExtensions.has(file.ext))
      .slice(0, this.options.maxFiles ?? 120);

    const filePathSet = new Set(files.map((file) => file.path));
    const graphFiles = candidates.map((file) => this.analyzeFile(file, filePathSet));
    const edges = graphFiles.flatMap((file) =>
      file.internalDependencies.map((dependency) => ({
        from: file.path,
        to: dependency,
      }))
    );

    return {
      generatedAt: Date.now(),
      fileCount: graphFiles.length,
      files: graphFiles,
      edges,
      parseErrors: graphFiles
        .filter((file) => file.parseError)
        .map((file) => ({ path: file.path, error: file.parseError ?? 'parse-error' })),
    };
  }

  /**
   * 分析单个源码文件的 imports、exports、声明符号和内部依赖。
   */
  private analyzeFile(file: RepoMapFile, filePathSet: Set<string>): CodeGraphFile {
    const baseResult: CodeGraphFile = {
      path: file.path,
      imports: [],
      exports: [],
      symbols: [],
      internalDependencies: [],
    };

    let content: string;
    try {
      content = this.readLimitedFile(file);
    } catch {
      return { ...baseResult, parseError: 'read-error' };
    }

    try {
      const ast = parse(content, {
        sourceType: 'unambiguous',
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'classPrivateProperties',
          'classPrivateMethods',
          'dynamicImport',
          'importMeta',
          'topLevelAwait',
        ],
      });

      const result = this.extractTopLevelStructure(
        file.path,
        this.asNodeArray(ast.program.body),
        filePathSet
      );
      return {
        path: file.path,
        ...result,
      };
    } catch (error) {
      return {
        ...baseResult,
        parseError: error instanceof Error ? error.message : 'parse-error',
      };
    }
  }

  private readLimitedFile(file: RepoMapFile): string {
    const absolutePath = path.resolve(this.cwd, file.path);
    const bytesToRead = Math.min(file.size, this.options.maxBytesPerFile ?? 80_000);
    const buffer = Buffer.alloc(bytesToRead);
    const fd = fs.openSync(absolutePath, 'r');
    try {
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
      return buffer.subarray(0, bytesRead).toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  }

  private extractTopLevelStructure(
    fromPath: string,
    statements: AstNode[],
    filePathSet: Set<string>
  ): Omit<CodeGraphFile, 'path' | 'parseError'> {
    const imports: CodeGraphImport[] = [];
    const exports: string[] = [];
    const symbols: CodeGraphSymbol[] = [];

    for (const statement of statements) {
      if (statement.type === 'ImportDeclaration') {
        const source = this.getNodeString(this.asNode(statement.source), 'value');
        imports.push({
          source: source ?? 'unknown',
          imported: this.extractImportSpecifiers(this.asNodeArray(statement.specifiers)),
          kind: 'static',
        });
        continue;
      }

      if (statement.type === 'ExportNamedDeclaration') {
        const source = this.getNodeString(this.asNode(statement.source), 'value');
        if (source) {
          imports.push({
            source,
            imported: this.extractExportSpecifiers(this.asNodeArray(statement.specifiers)),
            kind: 're-export',
          });
        }
        exports.push(...this.extractExportNames(statement));
        symbols.push(...this.extractDeclarationSymbols(this.asNode(statement.declaration), true));
        continue;
      }

      if (statement.type === 'ExportDefaultDeclaration') {
        exports.push('default');
        symbols.push(...this.extractDefaultExportSymbol(this.asNode(statement.declaration)));
        continue;
      }

      imports.push(...this.extractRequireImports(statement));
      symbols.push(...this.extractDeclarationSymbols(statement, false));
    }

    const limitedImports = imports.slice(0, this.options.maxImportsPerFile ?? 12);
    const limitedSymbols = symbols.slice(0, this.options.maxSymbolsPerFile ?? 16);
    const internalDependencies = this.resolveInternalDependencies(
      fromPath,
      limitedImports,
      filePathSet
    );

    return {
      imports: limitedImports,
      exports: Array.from(new Set(exports)),
      symbols: limitedSymbols,
      internalDependencies,
    };
  }

  private extractImportSpecifiers(specifiers: AstNode[]): string[] {
    if (specifiers.length === 0) {
      return ['side-effect'];
    }

    return specifiers.map((specifier) => {
      if (specifier.type === 'ImportDefaultSpecifier') return 'default';
      if (specifier.type === 'ImportNamespaceSpecifier') return '*';
      return (
        this.getNodeString(this.asNode(specifier.imported), 'name') ??
        this.getNodeString(this.asNode(specifier.imported), 'value') ??
        this.getNodeString(this.asNode(specifier.local), 'name') ??
        'unknown'
      );
    });
  }

  private extractExportSpecifiers(specifiers: AstNode[]): string[] {
    return specifiers.map(
      (specifier) =>
        this.getNodeString(this.asNode(specifier.exported), 'name') ??
        this.getNodeString(this.asNode(specifier.exported), 'value') ??
        'unknown'
    );
  }

  private extractExportNames(statement: AstNode): string[] {
    const names = this.extractDeclarationSymbols(this.asNode(statement.declaration), true).map(
      (symbol) => symbol.name
    );

    for (const specifier of this.asNodeArray(statement.specifiers)) {
      names.push(
        this.getNodeString(this.asNode(specifier.exported), 'name') ??
          this.getNodeString(this.asNode(specifier.exported), 'value') ??
          'unknown'
      );
    }

    return names;
  }

  private extractDefaultExportSymbol(declaration: AstNode | undefined): CodeGraphSymbol[] {
    if (!declaration) {
      return [{ name: 'default', kind: 'default', exported: true }];
    }

    const symbols = this.extractDeclarationSymbols(declaration, true);
    if (symbols.length > 0) {
      return symbols.map((symbol) => ({ ...symbol, exported: true }));
    }

    return [{ name: 'default', kind: 'default', exported: true }];
  }

  private extractDeclarationSymbols(
    declaration: AstNode | undefined,
    exported: boolean
  ): CodeGraphSymbol[] {
    if (!declaration) {
      return [];
    }

    const idName = this.getNodeString(this.asNode(declaration.id), 'name');
    if (declaration.type === 'FunctionDeclaration' && idName) {
      return [{ name: idName, kind: 'function', exported }];
    }
    if (declaration.type === 'ClassDeclaration' && idName) {
      return [{ name: idName, kind: 'class', exported }];
    }
    if (declaration.type === 'TSInterfaceDeclaration' && idName) {
      return [{ name: idName, kind: 'interface', exported }];
    }
    if (declaration.type === 'TSTypeAliasDeclaration' && idName) {
      return [{ name: idName, kind: 'type', exported }];
    }
    if (declaration.type === 'TSEnumDeclaration' && idName) {
      return [{ name: idName, kind: 'enum', exported }];
    }
    if (declaration.type === 'VariableDeclaration') {
      return this.asNodeArray(declaration.declarations)
        .map((item) => this.extractIdentifierName(this.asNode(item.id)))
        .filter((name: string | undefined): name is string => Boolean(name))
        .map((name: string) => ({
          name,
          kind: this.getNodeString(declaration, 'kind') ?? 'const',
          exported,
        }));
    }

    return [];
  }

  private extractRequireImports(statement: AstNode): CodeGraphImport[] {
    if (statement.type !== 'VariableDeclaration') {
      return [];
    }

    const imports: CodeGraphImport[] = [];
    for (const declaration of this.asNodeArray(statement.declarations)) {
      const source = this.extractRequireSource(this.asNode(declaration.init));
      if (!source) {
        continue;
      }

      imports.push({
        source,
        imported: [this.extractIdentifierName(this.asNode(declaration.id)) ?? 'require'],
        kind: 'require',
      });
    }

    return imports;
  }

  private extractRequireSource(init: AstNode | undefined): string | undefined {
    const callee = this.asNode(init?.callee);
    const firstArgument = this.asNode(this.asArray(init?.arguments)[0]);
    if (
      init?.type === 'CallExpression' &&
      callee?.type === 'Identifier' &&
      this.getNodeString(callee, 'name') === 'require' &&
      firstArgument?.type === 'StringLiteral'
    ) {
      return this.getNodeString(firstArgument, 'value');
    }

    return undefined;
  }

  private extractIdentifierName(node: AstNode | undefined): string | undefined {
    if (!node) {
      return undefined;
    }
    if (node.type === 'Identifier') {
      return this.getNodeString(node, 'name');
    }
    if (node.type === 'ObjectPattern') {
      return this.asNodeArray(node.properties)
        .map((property) =>
          this.extractIdentifierName(this.asNode(property.key ?? property.argument))
        )
        .filter(Boolean)
        .join(', ');
    }

    return undefined;
  }

  private resolveInternalDependencies(
    fromPath: string,
    imports: CodeGraphImport[],
    filePathSet: Set<string>
  ): string[] {
    const dependencies = imports
      .map((item) => this.resolveImportSource(fromPath, item.source, filePathSet))
      .filter((resolved): resolved is string => Boolean(resolved));

    return Array.from(new Set(dependencies)).sort();
  }

  private resolveImportSource(
    fromPath: string,
    source: string,
    filePathSet: Set<string>
  ): string | undefined {
    if (!source.startsWith('.')) {
      return undefined;
    }

    const basePath = path.normalize(path.join(path.dirname(fromPath), source));
    const candidates = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.tsx`,
      `${basePath}.js`,
      `${basePath}.jsx`,
      path.join(basePath, 'index.ts'),
      path.join(basePath, 'index.tsx'),
      path.join(basePath, 'index.js'),
      path.join(basePath, 'index.jsx'),
    ].map((candidate) => candidate.replace(/\\/g, '/'));

    return candidates.find((candidate) => filePathSet.has(candidate));
  }

  private asNode(value: unknown): AstNode | undefined {
    if (value && typeof value === 'object') {
      return value as AstNode;
    }

    return undefined;
  }

  private asNodeArray(value: unknown): AstNode[] {
    return this.asArray(value)
      .map((item) => this.asNode(item))
      .filter((item): item is AstNode => Boolean(item));
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private getNodeString(node: AstNode | undefined, key: string): string | undefined {
    const value = node?.[key];
    return typeof value === 'string' ? value : undefined;
  }
}
