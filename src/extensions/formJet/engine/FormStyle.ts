// Stílusbeállítások: ellenőrzés (parseConfig) és módonkénti feloldás (base + az aktuális mód felülírása).
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.
// A színek kizárólag hex értékek lehetnek, így a konfigurációból nem kerülhet tetszőleges CSS a lapra.

import {
  DENSITIES,
  FormMode,
  IFieldStyle,
  IFormStyle,
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

/** Egy stílustulajdonság fajtája: szín, szélesség (px), vagy a megengedett értékek listája. */
type StyleProperty = 'color' | 'width' | string[];
type StyleSpec = Record<string, StyleProperty>;

const FORM_STYLE_SPEC: StyleSpec = {
  accentColor: 'color',
  background: 'color',
  maxWidth: 'width',
  density: DENSITIES,
  sectionHeader: SECTION_HEADER_STYLES
};
const SECTION_STYLE_SPEC: StyleSpec = { background: 'color', borderColor: 'color', headerColor: 'color' };
const FIELD_STYLE_SPEC: StyleSpec = { background: 'color', labelColor: 'color' };

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

export function isFormWidth(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value) && value >= MIN_FORM_WIDTH && value <= MAX_FORM_WIDTH;
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

/** A módban érvényes stílus: a `base`, amelyet az adott mód beállításai felülírnak. */
export function resolveModeStyle<T extends object>(styles: IModeStyles<T> | undefined, mode: FormMode): T {
  return { ...((styles?.base ?? {}) as object), ...((styles?.[mode] ?? {}) as object) } as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    if (property === 'color') {
      if (!isHexColor(value)) {
        throw new Error(format(engineStrings().InvalidColor, `${path}.${key}`));
      }
    } else if (property === 'width') {
      if (!isFormWidth(value)) {
        throw new Error(format(engineStrings().InvalidNumber, `${path}.${key}`, MIN_FORM_WIDTH, MAX_FORM_WIDTH));
      }
    } else if (property.indexOf(value as string) === -1) {
      throw new Error(format(engineStrings().InvalidOption, `${path}.${key}`, property.join(', ')));
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
