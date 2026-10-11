// Mellékletek: a pszeudo-mező neve és a fájlnevek ellenőrzése.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

/** A mellékletek a sémában ezzel a névvel és típussal szerepelnek, és mezőként helyezhetők el egy szekcióban. */
export const ATTACHMENTS_FIELD: string = 'Attachments';

export type AttachmentNameError = 'invalid' | 'duplicate';

// A SharePoint által fájlnévben nem engedett karakterek.
const INVALID_CHARACTERS: RegExp = /["*:<>?/\\|#%\t\r\n]/;
const MAX_NAME_LENGTH: number = 250;

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
