// Mellékletek: a pszeudo-mező neve és a fájlnevek ellenőrzése.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

/** A mellékletek a sémában ezzel a névvel és típussal szerepelnek, és mezőként helyezhetők el egy szekcióban. */
export const ATTACHMENTS_FIELD: string = 'Attachments';

export type AttachmentNameError = 'invalid' | 'duplicate';

// A SharePoint által fájlnévben nem engedett karakterek.
const INVALID_CHARACTERS: RegExp = /["*:<>?/\\|#%\t\r\n]/;
const MAX_NAME_LENGTH: number = 250;

const IMAGE_EXTENSIONS: string[] = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
const SIZE_UNITS: string[] = ['B', 'KB', 'MB', 'GB'];
const SIZE_STEP: number = 1024;

/** Kép-e a fájl a kiterjesztése alapján (ilyenkor miniatűr jelenik meg róla). */
export function isImageFileName(name: string): boolean {
  const dot: number = name.lastIndexOf('.');
  return dot !== -1 && IMAGE_EXTENSIONS.indexOf(name.slice(dot + 1).toLowerCase()) !== -1;
}

/**
 * A fájlméret olvasható alakban, pl. `512 B`, `12,3 KB`, `4,5 MB`; a tizedesjel a megadott.
 * Érvénytelen (negatív vagy nem véges) méretre üres szöveg.
 */
export function formatFileSize(bytes: number | undefined, decimalSeparator: string = '.'): string {
  if (bytes === undefined || !isFinite(bytes) || bytes < 0) {
    return '';
  }
  let value: number = bytes;
  let unit: number = 0;
  while (value >= SIZE_STEP && unit < SIZE_UNITS.length - 1) {
    value /= SIZE_STEP;
    unit++;
  }
  // Bájtban egész szám; nagyobb egységnél egy tizedesjegy, a felesleges `,0` nélkül.
  const rounded: number = unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded).replace('.', decimalSeparator)} ${SIZE_UNITS[unit]}`;
}

/** Hozzáadható-e a fájl ezen a néven; `taken` a már meglévő és a hozzáadásra váró mellékletek neve. */
export function validateAttachmentName(name: string, taken: string[]): AttachmentNameError | undefined {
  const trimmed: string = name.trim();
  if (
    trimmed === '' ||
    trimmed.length > MAX_NAME_LENGTH ||
    INVALID_CHARACTERS.test(trimmed) ||
    trimmed[0] === '.' ||
    trimmed[trimmed.length - 1] === '.'
  ) {
    return 'invalid';
  }
  // A SharePoint a fájlneveket kis- és nagybetűtől függetlenül kezeli.
  const lower: string = trimmed.toLowerCase();
  return taken.some((item) => item.toLowerCase() === lower) ? 'duplicate' : undefined;
}
