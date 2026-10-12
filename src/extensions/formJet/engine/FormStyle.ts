// Stílusbeállítások: ellenőrzés (parseConfig) és módonkénti feloldás (base + az aktuális mód felülírása).
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.
// A színek kizárólag hex értékek lehetnek, a színátmenet pedig ellenőrzött részekből áll össze,
// így a konfigurációból nem kerülhet tetszőleges CSS a lapra.

import {
  DENSITIES,
  FormMode,
  GRADIENT_TYPES,
  GradientType,
  IBoxStyle,
  IFieldStyle,
  IFormStyle,
  IGradient,
  IModeStyles,
  ISectionStyle,
  SECTION_HEADER_STYLES
} from '../models/IFormConfig';
import { engineStrings, format } from './EngineStrings';

export const MIN_FORM_WIDTH: number = 320;
export const MAX_FORM_WIDTH: number = 2400;

export type StyleScope = 'base' | FormMode;
export const STYLE_SCOPES: StyleScope[] = ['base', 'new', 'edit', 'display'];

const HEX_COLOR: RegExp = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const MAX_BORDER_WIDTH: number = 8;
export const MAX_BORDER_RADIUS: number = 24;
export const DEFAULT_GRADIENT_ANGLE: number = 180;

interface INumberRange {
  min: number;
  max: number;
}

/** Egy stílustulajdonság fajtája: szín, színátmenet, számtartomány, vagy a megengedett értékek listája. */
type StyleProperty = 'color' | 'gradient' | INumberRange | string[];
type StyleSpec = Record<string, StyleProperty>;

/** Háttér és keret: a formon, a szekción és a mezőn is megadható. */
const BOX_STYLE_SPEC: StyleSpec = {
  background: 'color',
  backgroundGradient: 'gradient',
  borderColor: 'color',
  borderWidth: { min: 0, max: MAX_BORDER_WIDTH },
  borderRadius: { min: 0, max: MAX_BORDER_RADIUS }
};
const FORM_STYLE_SPEC: StyleSpec = {
  ...BOX_STYLE_SPEC,
  accentColor: 'color',
  maxWidth: { min: MIN_FORM_WIDTH, max: MAX_FORM_WIDTH },
  density: DENSITIES,
  sectionHeader: SECTION_HEADER_STYLES
};
const SECTION_STYLE_SPEC: StyleSpec = { ...BOX_STYLE_SPEC, headerColor: 'color' };
const FIELD_STYLE_SPEC: StyleSpec = { ...BOX_STYLE_SPEC, labelColor: 'color', textColor: 'color' };

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

const GRADIENT_ANGLE: INumberRange = { min: 0, max: 360 };

function isInRange(value: unknown, range: INumberRange): value is number {
  return typeof value === 'number' && isFinite(value) && value >= range.min && value <= range.max;
}

export function isFormWidth(value: unknown): value is number {
  return isInRange(value, { min: MIN_FORM_WIDTH, max: MAX_FORM_WIDTH });
}

/** Hat jegyű alak (#rgb → #rrggbb), kisbetűvel. */
export function normalizeHexColor(color: string): string {
  const hex: string = color.slice(1).toLowerCase();
  return hex.length === 3 ? `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : `#${hex}`;
}

/** Olvasható szövegszín (sötét vagy fehér) az adott háttérszínhez. */
export function contrastTextColor(background: string): string {
  const hex: string = normalizeHexColor(background);
  const r: number = parseInt(hex.slice(1, 3), 16);
  const g: number = parseInt(hex.slice(3, 5), 16);
  const b: number = parseInt(hex.slice(5, 7), 16);
  // Érzékelt világosság (YIQ).
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? '#201f1e' : '#ffffff';
}

/**
 * A módban érvényes stílus: a `base`, amelyet az adott mód beállításai tulajdonságonként felülírnak.
 * Ha a mód egyszínű hátteret ad meg színátmenet nélkül, az alap színátmenete nem öröklődik.
 */
export function resolveModeStyle<T extends object>(styles: IModeStyles<T> | undefined, mode: FormMode): T {
  const own: IBoxStyle = (styles?.[mode] ?? {}) as IBoxStyle;
  const merged: IBoxStyle = { ...((styles?.base ?? {}) as object), ...(own as object) };
  if (own.background !== undefined && own.backgroundGradient === undefined) {
    delete merged.backgroundGradient;
  }
  return merged as T;
}

/**
 * A háttér CSS értéke: színátmenet, ennek hiányában az egyszínű háttér.
 * Az érték ellenőrzött részekből (típus, szög, hex színek) áll össze, szabad CSS nem kerül bele.
 */
export function backgroundCss(style: IBoxStyle): string | undefined {
  const gradient: IGradient | undefined = style.backgroundGradient;
  if (!gradient || !isHexColor(gradient.colors[0]) || !isHexColor(gradient.colors[1])) {
    return style.background;
  }
  const colors: string = `${gradient.colors[0]}, ${gradient.colors[1]}`;
  if (gradient.type === 'radial') {
    return `radial-gradient(circle at center, ${colors})`;
  }
  const angle: number = isInRange(gradient.angle, GRADIENT_ANGLE) ? gradient.angle : DEFAULT_GRADIENT_ANGLE;
  return `linear-gradient(${angle}deg, ${colors})`;
}

/** Van-e a stílusnak látható háttere vagy kerete (ilyenkor az elem belső margót kap). */
export function hasBox(style: IBoxStyle): boolean {
  return backgroundCss(style) !== undefined || style.borderColor !== undefined || (style.borderWidth ?? 0) > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseGradient(input: unknown, path: string): IGradient {
  if (!isRecord(input)) {
    throw new Error(format(engineStrings().MustBeObject, path));
  }
  if (GRADIENT_TYPES.indexOf(input.type as GradientType) === -1) {
    throw new Error(format(engineStrings().InvalidOption, `${path}.type`, GRADIENT_TYPES.join(', ')));
  }
  const colors: unknown = input.colors;
  if (!Array.isArray(colors) || colors.length !== 2) {
    throw new Error(format(engineStrings().InvalidGradientColors, `${path}.colors`));
  }
  colors.forEach((color, i) => {
    if (!isHexColor(color)) {
      throw new Error(format(engineStrings().InvalidColor, `${path}.colors[${i}]`));
    }
  });
  const gradient: IGradient = { type: input.type as GradientType, colors: [colors[0], colors[1]] };
  // A szögnek csak lineáris átmenetnél van értelme.
  if (gradient.type === 'linear' && input.angle !== undefined) {
    if (!isInRange(input.angle, GRADIENT_ANGLE)) {
      throw new Error(format(engineStrings().InvalidNumber, `${path}.angle`, GRADIENT_ANGLE.min, GRADIENT_ANGLE.max));
    }
    gradient.angle = input.angle;
  }
  return gradient;
}

function parseStyle(input: unknown, path: string, spec: StyleSpec): Record<string, unknown> | undefined {
  if (!isRecord(input)) {
    throw new Error(format(engineStrings().MustBeObject, path));
  }
  const result: Record<string, unknown> = {};
  // Az ismeretlen kulcsokat elhagyjuk: csak a specifikációban szereplő tulajdonság kerülhet a formra.
  Object.keys(spec).forEach((key) => {
    const value: unknown = input[key];
    if (value === undefined) {
      return;
    }
    const property: StyleProperty = spec[key];
    if (property === 'gradient') {
      result[key] = parseGradient(value, `${path}.${key}`);
      return;
    }
    if (property === 'color') {
      if (!isHexColor(value)) {
        throw new Error(format(engineStrings().InvalidColor, `${path}.${key}`));
      }
    } else if (Array.isArray(property)) {
      if (property.indexOf(value as string) === -1) {
        throw new Error(format(engineStrings().InvalidOption, `${path}.${key}`, property.join(', ')));
      }
    } else if (!isInRange(value, property)) {
      throw new Error(format(engineStrings().InvalidNumber, `${path}.${key}`, property.min, property.max));
    }
    result[key] = value;
  });
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseModeStyles<T>(input: unknown, path: string, spec: StyleSpec): IModeStyles<T> | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!isRecord(input)) {
    throw new Error(format(engineStrings().MustBeObject, path));
  }
  const result: IModeStyles<T> = {};
  STYLE_SCOPES.forEach((scope) => {
    if (input[scope] !== undefined) {
      const style: Record<string, unknown> | undefined = parseStyle(input[scope], `${path}.${scope}`, spec);
      if (style) {
        result[scope] = style as T;
      }
    }
  });
  return Object.keys(result).length > 0 ? result : undefined;
}

export function parseFormStyles(input: unknown, path: string): IModeStyles<IFormStyle> | undefined {
  return parseModeStyles<IFormStyle>(input, path, FORM_STYLE_SPEC);
}

export function parseSectionStyles(input: unknown, path: string): IModeStyles<ISectionStyle> | undefined {
  return parseModeStyles<ISectionStyle>(input, path, SECTION_STYLE_SPEC);
}

export function parseFieldStyles(input: unknown, path: string): IModeStyles<IFieldStyle> | undefined {
  return parseModeStyles<IFieldStyle>(input, path, FIELD_STYLE_SPEC);
}
