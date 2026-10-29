// A menüpont ikonja: a Command Set csak képcímet (iconImageUrl) fogad, ezért a Fluent UI ikont (a lapon már regisztrált
// ikonbetűkészlet karakterét) vászonra rajzoljuk, és PNG data URL-ként adjuk át. Ikonnevenként egyszer készül el.

import { getIcon, IIconRecord } from '@fluentui/react/lib/Styling';

/** A kép mérete pixelben: a menü 16 pixelen jeleníti meg, a kétszeres méret a nagy felbontású kijelzőkhöz kell. */
const SIZE: number = 32;
const COLOR: string = '#323130';

const cache: Map<string, Promise<string | undefined>> = new Map();

async function render(name: string): Promise<string | undefined> {
  const icon: IIconRecord | undefined = getIcon(name);
  const fontFamily: string | undefined = icon?.subset.fontFace?.fontFamily;
  if (!icon || !fontFamily || !icon.code) {
    return undefined;
  }
  const font: string = `${SIZE}px ${fontFamily}`;
  await document.fonts.load(font, icon.code);
  if (!document.fonts.check(font, icon.code)) {
    return undefined;
  }
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
  if (!context) {
    return undefined;
  }
  context.font = font;
  context.fillStyle = COLOR;
  context.textBaseline = 'alphabetic';
  // A karakter tényleges befoglaló téglalapját igazítjuk középre.
  const metrics: TextMetrics = context.measureText(icon.code);
  const width: number = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
  const height: number = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  context.fillText(icon.code, (SIZE - width) / 2 + metrics.actualBoundingBoxLeft, (SIZE - height) / 2 + metrics.actualBoundingBoxAscent);
  return canvas.toDataURL('image/png');
}

/** Az ikon képe data URL-ként; ha az ikon nem ismert vagy a betűkészlet nem tölthető be, `undefined`. */
export function getCommandIconUrl(name: string): Promise<string | undefined> {
  let result: Promise<string | undefined> | undefined = cache.get(name);
  if (!result) {
    result = render(name).catch(() => undefined);
    cache.set(name, result);
  }
  return result;
}
