import type { StandardToolResult } from '../managers/ToolManager';

export interface ToolTraceOptions {
  maxEntries?: number;
}

export type ToolTraceRecord = StandardToolResult & {
  id: string;
  sequence: number;
  finishedAt: number;
};

/**
 * ToolTraceService 记录标准化工具调用结果。
 *
 * 调用链路：
 * ModelService tool execute -> ToolManager.executeWithResult -> ToolTraceService.record
 *
 * 本章先使用内存环形列表，避免把 trace 持久化、压缩和隐私治理混在一起。
 * 后续 Harness / Eval 可以直接读取这里的标准记录做回放和评分。
 */
export class ToolTraceService {
  private records: ToolTraceRecord[] = [];
  private sequence = 0;
  private maxEntries: number;

  constructor(options: ToolTraceOptions = {}) {
    this.maxEntries = options.maxEntries ?? 100;
  }

  /**
   * 记录一次工具调用结果，并返回写入后的 trace record。
   */
  record(result: StandardToolResult): ToolTraceRecord {
    // 1. sequence 单调递增，方便后续按真实执行顺序回放工具调用。
    this.sequence += 1;

    // 2. StandardToolResult.timestamp 表示开始时间，durationMs 表示耗时。
    const record: ToolTraceRecord = {
      ...result,
      id: `tool-trace-${this.sequence}`,
      sequence: this.sequence,
      finishedAt: result.timestamp + result.durationMs,
    };

    // 3. 内存 trace 保留最近 N 条，避免长会话无限增长。
    this.records.push(record);
    if (this.records.length > this.maxEntries) {
      this.records = this.records.slice(-this.maxEntries);
    }

    return record;
  }

  list(): ToolTraceRecord[] {
    return [...this.records];
  }

  latest(): ToolTraceRecord | undefined {
    return this.records.at(-1);
  }

  clear(): void {
    this.records = [];
  }
}
