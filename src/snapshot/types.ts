/**
 * 文件快照
 */
export interface FileSnapshot {
  path: string; // 文件路径（绝对路径）
  content: string; // 文件内容
  hash: string; // 内容哈希（SHA-256）
}

/**
 * 快照
 */ export interface Snapshot {
  id: string; // 快照 ID
  messageId: string; // 关联的消息 ID
  timestamp: Date; // 创建时间
  files: FileSnapshot[]; // 文件快照列表
  description?: string; // 描述
}

/**
 * Diff 信息
 */ export interface Diff {
  path: string; // 文件路径
  oldContent: string; // 当前内容
  newContent: string; // 快照内容
  changes: string; // diff 文本（简单的行级 diff）
}
