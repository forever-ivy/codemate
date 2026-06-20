import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';

/**
 * RewindCommand - 回退到之前的文件版本
 *
 * 用法：
 * - /rewind                         回退到最新快照
 * - /rewind snapshot-xxx            回退到指定快照
 * - /rewind --preview               预览回退效果
 * - /rewind snapshot-xxx --preview  预览指定快照的回退效果
 */
export class RewindCommand extends SlashCommand {
  name = 'rewind';
  description = '回退到之前的文件版本';
  aliases = ['undo'];

  async execute(args: string[], app: Application): Promise<void> {
    const fileHistory = app.getContainer().getFileHistory();
    const snapshots = fileHistory.listSnapshots();

    // 检查是否有快照
    if (snapshots.length === 0) {
      console.log('❌ 没有可用的快照');
      return;
    }

    // 解析参数
    const isPreview = args.includes('--preview');
    const snapshotId = args.find((arg) => !arg.startsWith('--'));

    // 确定目标快照
    const targetSnapshot = snapshotId ? snapshots.find((s) => s.id === snapshotId) : snapshots[0]; // 默认使用最新的

    if (!targetSnapshot) {
      console.log(`❌ 找不到快照: ${snapshotId}`);
      return;
    }

    if (isPreview) {
      // 预览模式
      console.log(`\n🔍 预览回退到: ${targetSnapshot.id}`);
      console.log(`📅 时间: ${targetSnapshot.timestamp.toLocaleString()}`);

      const diffs = await fileHistory.previewRewind(targetSnapshot.id);

      if (diffs.length === 0) {
        console.log('\n✅ 没有变化');
        return;
      }

      console.log(`\n📝 将会恢复 ${diffs.length} 个文件:\n`);

      for (const diff of diffs) {
        console.log(`📄 ${diff.path}`);
        console.log(diff.changes);
        console.log('');
      }
    } else {
      // 执行回退
      console.log(`\n⏪ 回退到: ${targetSnapshot.id}`);
      console.log(`📅 时间: ${targetSnapshot.timestamp.toLocaleString()}`);

      await fileHistory.rewindTo(targetSnapshot.id);

      console.log('\n✅ 回退完成！');
    }
  }
}
