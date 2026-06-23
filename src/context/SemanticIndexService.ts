import type { CodeGraph, CodeGraphFile, CodeGraphSymbol } from './CodeGraphService';
import type { RepoMapFile } from './RepoMapService';

export type SemanticDiagnosticSeverity = 'error' | 'warning' | 'info';

export interface SemanticSymbol {
  name: string;
  kind: string;
  path: string;
  exported: boolean;
}

export interface SemanticReference {
  from: string;
  to: string;
  kind: 'import';
}

export interface SemanticDiagnostic {
  path: string;
  severity: SemanticDiagnosticSeverity;
  message: string;
}

export interface SemanticIndex {
  generatedAt: number;
  fileCount: number;
  symbols: SemanticSymbol[];
  references: SemanticReference[];
  diagnostics: SemanticDiagnostic[];
  updatedFiles: string[];
}

export interface SemanticQueryResult {
  matchedSymbols: SemanticSymbol[];
  relatedFiles: string[];
  diagnostics: SemanticDiagnostic[];
}

/**
 * SemanticIndexService 把轻量 CodeGraph 转换成可增量更新的语义索引。
 *
 * 这一层刻意不绑定具体 LSP server。
 * 后续可以把 CodeGraphFile 的来源替换成 tsserver/LSP 返回的 symbols、references 和 diagnostics。
 */
export class SemanticIndexService {
  build(files: RepoMapFile[], codeGraph: CodeGraph): SemanticIndex {
    return {
      generatedAt: Date.now(),
      fileCount: files.length,
      symbols: codeGraph.files.flatMap((file) => this.symbolsForFile(file)),
      references: this.referencesForGraph(codeGraph),
      diagnostics: this.diagnosticsForGraph(codeGraph),
      updatedFiles: [],
    };
  }

  updateFile(index: SemanticIndex, graphFile: CodeGraphFile): SemanticIndex {
    const path = graphFile.path;
    const nextDiagnostics = graphFile.parseError
      ? [{ path, severity: 'error' as const, message: graphFile.parseError }]
      : [];

    return {
      generatedAt: Date.now(),
      fileCount: index.fileCount,
      symbols: [
        ...index.symbols.filter((symbol) => symbol.path !== path),
        ...this.symbolsForFile(graphFile),
      ],
      references: [
        ...index.references.filter((reference) => reference.from !== path),
        ...graphFile.internalDependencies.map((dependency) => ({
          from: path,
          to: dependency,
          kind: 'import' as const,
        })),
      ].sort(this.compareReference),
      diagnostics: [
        ...index.diagnostics.filter((diagnostic) => diagnostic.path !== path),
        ...nextDiagnostics,
      ].sort((a, b) => a.path.localeCompare(b.path) || a.message.localeCompare(b.message)),
      updatedFiles: [path],
    };
  }

  removeFile(index: SemanticIndex, filePath: string): SemanticIndex {
    return {
      generatedAt: Date.now(),
      fileCount: Math.max(0, index.fileCount - 1),
      symbols: index.symbols.filter((symbol) => symbol.path !== filePath),
      references: index.references.filter(
        (reference) => reference.from !== filePath && reference.to !== filePath
      ),
      diagnostics: index.diagnostics.filter((diagnostic) => diagnostic.path !== filePath),
      updatedFiles: [filePath],
    };
  }

  query(index: SemanticIndex, message: string): SemanticQueryResult {
    const queryTokens = this.tokenize(message);
    const matchedSymbols = index.symbols
      .map((symbol) => ({
        ...symbol,
        score: this.scoreSymbol(symbol, queryTokens),
      }))
      .filter((symbol) => symbol.score > 0)
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .map(({ score: _score, ...symbol }) => symbol);

    const relatedFiles = new Set<string>();
    for (const symbol of matchedSymbols) {
      relatedFiles.add(symbol.path);
      for (const reference of index.references) {
        if (reference.to === symbol.path) {
          relatedFiles.add(reference.from);
        }
        if (reference.from === symbol.path) {
          relatedFiles.add(reference.to);
        }
      }
    }

    return {
      matchedSymbols,
      relatedFiles: Array.from(relatedFiles).sort(),
      diagnostics: index.diagnostics.filter((diagnostic) =>
        queryTokens.some((token) => this.tokenize(diagnostic.path).includes(token))
      ),
    };
  }

  private symbolsForFile(file: CodeGraphFile): SemanticSymbol[] {
    return file.symbols.map((symbol: CodeGraphSymbol) => ({
      name: symbol.name,
      kind: symbol.kind,
      path: file.path,
      exported: symbol.exported,
    }));
  }

  private referencesForGraph(codeGraph: CodeGraph): SemanticReference[] {
    return codeGraph.edges
      .map((edge) => ({
        from: edge.from,
        to: edge.to,
        kind: 'import' as const,
      }))
      .sort(this.compareReference);
  }

  private diagnosticsForGraph(codeGraph: CodeGraph): SemanticDiagnostic[] {
    return codeGraph.parseErrors
      .map((error) => ({
        path: error.path,
        severity: 'error' as const,
        message: error.error,
      }))
      .sort((a, b) => a.path.localeCompare(b.path) || a.message.localeCompare(b.message));
  }

  private scoreSymbol(symbol: SemanticSymbol, queryTokens: string[]): number {
    const symbolTokens = this.tokenize(symbol.name);
    const pathTokens = this.tokenize(symbol.path);
    let score = 0;

    for (const token of queryTokens) {
      if (symbol.name.toLowerCase().includes(token)) score += 8;
      if (symbolTokens.includes(token)) score += 6;
      if (pathTokens.includes(token)) score += 2;
    }

    return score;
  }

  private tokenize(text: string): string[] {
    return text
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 2);
  }

  private compareReference(left: SemanticReference, right: SemanticReference): number {
    return left.from.localeCompare(right.from) || left.to.localeCompare(right.to);
  }
}
