// Device-local UI marker. It is deliberately excluded from exported finance data.
export const BACKUP_EXPORT_MARKER = 'backup_export_started_at';
export const BACKUP_REMINDER_DAYS = 30;

export function readBackupExportMarker(storage: Pick<Storage, 'getItem'>): number | null {
  try {
    const value = storage.getItem(BACKUP_EXPORT_MARKER);
    if (!value) return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  } catch { return null; }
}

export function shouldRemindBackup(lastExport: number | null, now = Date.now()): boolean {
  return lastExport === null || now - lastExport >= BACKUP_REMINDER_DAYS * 86_400_000;
}
