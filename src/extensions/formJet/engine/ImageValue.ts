// Kép (Thumbnail) mező form-string értéke: JSON objektum a fájl nevével és helyével.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

/** A SharePoint képobjektuma. Az itt fel nem sorolt tulajdonságokat is megőrizzük. */
export interface IImageData {
  fileName?: string;
  serverRelativeUrl?: string;
  serverUrl?: string;
  id?: string;
  /** Csak a formon: a kép ki van választva, de még nincs feltöltve (mentéskor töltődik fel). */
  pending?: boolean;
  [key: string]: unknown;
}

export interface IImageUploadInfo {
  fileName: string;
  serverRelativeUrl: string;
  /** A feltöltött fájl egyedi azonosítója. */
  id: string;
  /** A webhely kiszolgálójának címe, pl. `https://contoso.sharepoint.com`. */
  serverUrl: string;
  fieldName: string;
  fieldId: string;
}

/** Az elem mellékleteként tárolt kép fájlneve így kezdődik. */
const ATTACHMENT_PREFIX: string = 'Reserved_ImageAttachment_';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A form-string értelmezése. Üres vagy nem értelmezhető értékre, illetve fájlnév nélküli objektumra `undefined`. */
export function parseImageValue(value: string | undefined): IImageData | undefined {
  if (!value || value.trim() === '') {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) {
    return undefined;
  }
  const image: IImageData = parsed as IImageData;
  const hasFile: boolean = typeof image.fileName === 'string' && image.fileName.trim() !== '';
  const hasUrl: boolean = typeof image.serverRelativeUrl === 'string' && image.serverRelativeUrl.trim() !== '';
  return hasFile || hasUrl ? image : undefined;
}

/** A kiválasztott, de még fel nem töltött kép jelzése a form értékei között. */
export function createPendingImageValue(fileName: string): string {
  return JSON.stringify({ pending: true, fileName });
}

/** A feltöltött kép form-stringje, ahogy a SharePoint a kép mezőben tárolja. */
export function createImageValue(info: IImageUploadInfo): string {
  return JSON.stringify({
    type: 'thumbnail',
    fileName: info.fileName,
    nativeFile: {},
    fieldName: info.fieldName,
    serverUrl: info.serverUrl,
    fieldId: info.fieldId,
    serverRelativeUrl: info.serverRelativeUrl,
    id: info.id
  });
}

/** Webhelyen belüli útvonal-e (perjellel kezdődik, de nem protokoll nélküli külső cím). */
function isServerRelative(url: string): boolean {
  return url[0] === '/' && url[1] !== '/' && url.indexOf('\\') === -1;
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

/**
 * A kép megjeleníthető címe: a tárolt szerverrelatív útvonal, vagy az elem mellékleteként tárolt képnél
 * a melléklet útvonala. `undefined`, ha nem állítható elő biztonságos, webhelyen belüli cím.
 */
export function getImageUrl(image: IImageData, listUrl: string | undefined, itemId: number | undefined): string | undefined {
  const url: string = typeof image.serverRelativeUrl === 'string' ? image.serverRelativeUrl.trim() : '';
  if (url !== '') {
    return isServerRelative(url) ? encodePath(decodeSafely(url)) : undefined;
  }
  const fileName: string = typeof image.fileName === 'string' ? image.fileName : '';
  if (fileName.indexOf(ATTACHMENT_PREFIX) === 0 && listUrl && isServerRelative(listUrl) && itemId !== undefined) {
    return `${encodePath(listUrl)}/Attachments/${itemId}/${encodeURIComponent(fileName)}`;
  }
  return undefined;
}

/** A tárolt útvonal lehet már kódolt; egységesen dekódolva kódoljuk újra. */
function decodeSafely(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}
