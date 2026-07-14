// Canonical client-side file download — one Blob/object-URL path for every
// "download X" action (transcripts, reports, future exports). UTF-8 with BOM
// so Hebrew text opens correctly in Windows editors.
export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
