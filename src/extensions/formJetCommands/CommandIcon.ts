// A menüpont ikonja: a Command Set csak képcímet (iconImageUrl) fogad, ezért a Fluent UI ikont (a lapon már regisztrált
// ikonbetűkészlet karakterét) vászonra rajzoljuk, és PNG data URL-ként adjuk át. A szín a lap témájából jön (a gyári
// menüpontok ikonszíne). Ikonnevenként és színenként egyszer készül el; a sikertelen kísérlet később megismételhető
// (pl. ha a lap az ikonokat vagy a betűkészletet még nem töltötte be).

import { getIcon, getTheme, IIconRecord } from '@fluentui/react/lib/Styling';

/** A kép mérete pixelben: a menü 16 pixelen jeleníti meg, a kétszeres méret a nagy felbontású kijelzőkhöz kell. */
const SIZE: number = 32;
const HEX_COLOR: RegExp = /^#[0-9a-fA-F]{3,8}$/;

const cache: Map<string, Promise<string | undefined>> = new Map();

/** A menü ikonszíne: a SharePoint lap témája (`__themeState__`), ennek hiányában a Fluent téma. */
function iconColor(): string {
  const theme: Record<string, unknown> | undefined = (window as unknown as { __themeState__?: { theme?: Record<string, unknown> } }).__themeState__?.theme;
  const candidates: unknown[] = [theme?.menuIcon, theme?.themePrimary, getTheme().semanticColors.menuIcon];
  const color: unknown = candidates.find((value) => typeof value === 'string' && HEX_COLOR.test(value));
  return typeof color === 'string' ? color : '#0078d4';
}

async function render(name: string, color: string): Promise<string | undefined> {
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
  context.fillStyle = color;
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
  const key: string = `${name}|${iconColor()}`;
  let result: Promise<string | undefined> | undefined = cache.get(key);
  if (!result) {
    result = render(name, iconColor()).catch(() => undefined);
    cache.set(key, result);
    // A sikertelen kísérletet nem jegyezzük meg, így a következő kérés újrapróbálja.
    result.then((url) => (url ? undefined : cache.delete(key))).catch(() => undefined);
  }
  return result;
}
