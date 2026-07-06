import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToolApprovalRequestService } from '../../../src/tools/ToolApprovalRequestService';

describe('ToolApprovalRequestService', () => {
  const fixtureDir = path.join(process.cwd(), 'tmp-tool-approval-preview-fixture');

  beforeEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await fs.mkdir(path.join(fixtureDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(fixtureDir, 'src/a.ts'), 'old\n', 'utf-8');
  });

  afterEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  });

  it('uses the exact apply_patch payload as its diff preview', async () => {
    const service = new ToolApprovalRequestService();
    const patch = '--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old\n+new\n';

    const request = await service.createRequest(
      'apply_patch',
      { patch },
      {
        status: 'requires_approval',
        risk: 'write',
        reason: 'apply_patch requires user approval in default mode.',
      },
      fixtureDir
    );

    expect(request.preview).toEqual({
      kind: 'file_diff',
      relativePath: 'src/a.ts',
      beforeExists: true,
      diff: patch,
      summary: 'Patch preview for 1 file: src/a.ts',
    });
    expect(request.terminalPreview).toContain(patch);
  });
});
