/**
 * Kopieren und Herunterladen im Partnerstatus. Die Signatur geht formatiert in die
 * Zwischenablage (text/html), damit Gmail und Outlook sie beim Einfügen übernehmen;
 * wo der Browser das nicht kann, als reiner Text.
 */
export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export async function copyRich(html: string, text: string) {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    })]);
    return;
  }
  await navigator.clipboard.writeText(text);
}

function save(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBase64(base64: string, fileName: string, type: string) {
  save(new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], { type }), fileName);
}

export function downloadText(text: string, fileName: string, type: string) {
  save(new Blob([text], { type }), fileName);
}

/** SVG (etwa den QR-Code) als PNG speichern, in Druckgröße. */
export async function downloadSvgAsPng(svg: string, fileName: string, size = 1024) {
  const img = new Image();
  const loaded = new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Bild nicht lesbar')); });
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await loaded;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kein Zeichenbereich');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, size, size);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG nicht erzeugt');
  save(blob, fileName);
}
