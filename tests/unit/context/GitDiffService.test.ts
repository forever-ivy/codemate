import { describe, expect, it } from 'vitest';
import { GitDiffService } from '../../../src/context/GitDiffService';

describe('GitDiffService', () => {
  it('should parse porcelain status output into changed files', () => {
    const service = new GitDiffService(process.cwd());

    const files = service.parseStatus(
      [
        ' M src/modified.ts',
        'A  src/added.ts',
        ' D src/deleted.ts',
        'R  src/old.ts -> src/new.ts',
        '?? src/untracked.ts',
      ].join('\n')
    );

    expect(files).toEqual([
      { path: 'src/modified.ts', status: 'modified' },
      { path: 'src/added.ts', status: 'added' },
      { path: 'src/deleted.ts', status: 'deleted' },
      { path: 'src/new.ts', status: 'renamed' },
      { path: 'src/untracked.ts', status: 'untracked' },
    ]);
  });

  it('should return an empty list for empty status output', () => {
    const service = new GitDiffService(process.cwd());

    expect(service.parseStatus('')).toEqual([]);
  });
});
