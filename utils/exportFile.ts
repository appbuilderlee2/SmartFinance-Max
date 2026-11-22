import { registerPlugin } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { showAppAlert } from './appDialog';
import { makeId } from './id';
import { isNativeIos } from './ios';

const RecoveryExport = registerPlugin<{ save(options: { uri: string }): Promise<{ saved: boolean }> }>('RecoveryExport');

export async function exportTextFile(contents: string, filename: string, type: string, recovery = false): Promise<boolean> {
  if (isNativeIos) {
    const path = `smartfinance-exports/${makeId()}/${filename}`;
    const folder = path.slice(0, path.lastIndexOf('/'));
    try {
      const { uri } = await Filesystem.writeFile({ path, data: contents, encoding: Encoding.UTF8, directory: Directory.Cache, recursive: true });
      if (recovery) return (await RecoveryExport.save({ uri })).saved;
      await Share.share({ files: [uri], dialogTitle: filename });
      return true;
    } catch (error) {
      if (error instanceof Error && error.message === 'Share canceled') return false;
      throw error;
    } finally {
      await Filesystem.rmdir({ path: folder, directory: Directory.Cache, recursive: true }).catch(() => undefined);
    }
  }

  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

export async function shareOrDownloadText(contents: string, filename: string, type: string): Promise<void> {
  try {
    await exportTextFile(contents, filename, type);
  } catch {
    await showAppAlert('未能匯出檔案，請稍後再試。');
  }
}
