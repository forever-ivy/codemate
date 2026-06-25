import { z } from 'zod';
import type { Paths } from '../../services/Paths';
import { Tool } from '../base/Tool';
import { type PatchApplyResult, UnifiedPatchService } from './UnifiedPatchService';

/**
 * Applies a unified diff after complete multi-file preflight.
 */
export class ApplyPatchTool extends Tool<{ patch: string }, PatchApplyResult> {
  name = 'apply_patch';
  description =
    'Apply a unified diff to one or more workspace files. Prefer this for precise edits to existing files. All file patches are validated before any file is written.';

  schema = z.object({
    patch: z.string().min(1).describe('Unified diff with ---/+++/@@ headers'),
  });

  constructor(private cwd?: string) {
    super();
  }

  async execute(input: { patch: string }): Promise<PatchApplyResult> {
    const cwd = this.cwd ?? this.container?.get<Paths>('paths').getCwd() ?? process.cwd();
    const service = new UnifiedPatchService(cwd);
    const preview = await service.preview(input.patch);

    if (this.container) {
      const fileHistory = this.container.getFileHistory();
      for (const file of preview.files) {
        await fileHistory.trackFile(file.path);
      }
    }

    return service.apply(input.patch);
  }
}
