import type { ProgressEvent } from '../../progress/events.ts';
import { exportFileName, progressFile } from '../../progress/transfer.ts';

/**
 * Saves the event log as a file (SPEC §10.1). On a touch device that can share files, the share
 * sheet opens (an iPhone: save to Files, AirDrop or Mail it to the computer); anywhere else the
 * file downloads. Nothing is awaited before the share sheet opens, so the tap that asked for it
 * still counts as the user's gesture.
 */
export async function exportProgress(
  events: readonly ProgressEvent[],
  device: string,
  now: Date,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const name = exportFileName(now);
  const blob = new Blob([JSON.stringify(progressFile(events, device, now))], {
    type: 'application/json',
  });
  if (prefersShare()) {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return 'shared';
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
        // the share sheet refused: download instead
      }
    }
  }
  download(blob, name);
  return 'downloaded';
}

/** A phone or tablet whose browser can share files (only in a secure context). */
function prefersShare(): boolean {
  try {
    return (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      window.matchMedia('(pointer: coarse)').matches
    );
  } catch {
    return false;
  }
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  // Safari still reads the file after the click returns
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
