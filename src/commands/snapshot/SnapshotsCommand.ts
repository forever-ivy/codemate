import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';

/**
 * SnapshotsCommand - 列出所有文件快照
 *
 * 用法：
 * - /snapshots    列出所有快照
 */
export class SnapshotsCommand extends SlashCommand {
  name = 'snapshots';
  description = '列出所有文件快照';
  aliases = ['history'];

  async execute(_args: string[], app: Application): Promise<void> {
    const fileHistory = app.getContainer().getFileHistory();
    const snapshots = fileHistory.listSnapshots();

    if (snapshots.length === 0) {
      console.log('📸 还没有创建任何快照');
      return;
    }

    console.log(`\n📸 文件快照列表 (共 ${snapshots.length} 个):\n`);

    for (const snapshot of snapshots) {
      console.log(`ID: ${snapshot.id}`);
      console.log(`时间: ${snapshot.timestamp.toLocaleString()}`);
      console.log(`文件: ${snapshot.files.length} 个`);
      if (snapshot.description) {
        console.log(`描述: ${snapshot.description}`);
      }
      console.log('');
    }
  }
}
