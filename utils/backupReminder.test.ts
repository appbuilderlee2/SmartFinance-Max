import { describe, expect, it } from 'vitest';
import { BACKUP_EXPORT_MARKER, readBackupExportMarker, shouldRemindBackup } from './backupReminder';

describe('backup reminder', () => {
  it('reminds when no export is recorded or the marker is at least 30 days old', () => {
    const now = Date.parse('2026-09-23T00:00:00Z');
    expect(shouldRemindBackup(null, now)).toBe(true);
    expect(shouldRemindBackup(now - 29 * 86_400_000, now)).toBe(false);
    expect(shouldRemindBackup(now - 30 * 86_400_000, now)).toBe(true);
  });

  it('ignores invalid date markers', () => {
    expect(readBackupExportMarker({ getItem: key => key === BACKUP_EXPORT_MARKER ? 'bad' : null })).toBeNull();
    expect(readBackupExportMarker({ getItem: () => '2026-09-23T00:00:00Z' })).toBe(Date.parse('2026-09-23T00:00:00Z'));
  });
});
