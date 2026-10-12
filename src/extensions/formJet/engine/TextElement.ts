// Szövegelemek: a formon megjelenő sima szöveg, amely mögött nincs SharePoint mező. A sémában pszeudo-mezőként
// szerepelnek (mint a mellékletek), így a szekciókban ugyanúgy elhelyezhetők és áthelyezhetők, mint a mezők.
// Csak olvashatók, értékük nincs, ezért soha nem kerülnek a mentésbe.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

import { IFieldSchema } from '../models/IFieldSchema';
import { IFormConfig, ITextElement } from '../models/IFormConfig';
import { engineStrings, format } from './EngineStrings';

/** A szövegelem pszeudo-mezőjének típusa a sémában. */
export const TEXT_ELEMENT_TYPE: string = 'FormJetText';

/** A kettőspont miatt az azonosító nem ütközhet SharePoint mező belső nevével. */
const TEXT_ID_PREFIX: string = 'text:';
const TEXT_ID: RegExp = /^text:[A-Za-z0-9_-]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isTextElement(schema: IFieldSchema): boolean {
  return schema.TypeAsString === TEXT_ELEMENT_TYPE;
}

/** A séma kiegészítve a konfiguráció szövegelemeivel. Többször is hívható: a már szereplő elemet nem veszi fel újra. */
export function withTextElements(schema: IFieldSchema[], config: IFormConfig): IFieldSchema[] {
  const texts: Record<string, ITextElement> = config.texts ?? {};
  const missing: string[] = Object.keys(texts).filter((id) => !schema.some((field) => field.InternalName === id));
  if (missing.length === 0) {
    return schema;
  }
  return schema.concat(
    missing.map((id) => ({
      InternalName: id,
      Title: texts[id].name || id,
      TypeAsString: TEXT_ELEMENT_TYPE,
      Required: false,
      ReadOnlyField: true
    }))
  );
}

/**
 * Új szövegelem a megadott megnevezéssel. A megadott szekció végére kerül; ha nincs ilyen szekció, az utolsóéra,
 * szekció nélkül pedig nem elhelyezett elem marad.
 */
export function addTextElement(
  config: IFormConfig,
  name: string,
  sectionId?: string
): { config: IFormConfig; id: string } {
  const texts: Record<string, ITextElement> = config.texts ?? {};
  let n: number = Object.keys(texts).length + 1;
  while (texts[`${TEXT_ID_PREFIX}${n}`]) {
    n++;
  }
  const id: string = `${TEXT_ID_PREFIX}${n}`;
  const target: string | undefined = config.sections.some((section) => section.id === sectionId)
    ? sectionId
    : config.sections[config.sections.length - 1]?.id;
  return {
    id,
    config: {
      ...config,
      texts: { ...texts, [id]: { name } },
      sections: config.sections.map((section) =>
        section.id === target ? { ...section, fields: [...section.fields, { field: id }] } : section
      )
    }
  };
}

/** A szövegelem törlése: az elhelyezése, a beállításai és a stílusa is megszűnik. */
export function removeTextElement(config: IFormConfig, id: string): IFormConfig {
  const next: IFormConfig = {
    ...config,
    sections: config.sections.map((section) =>
      section.fields.some((placement) => placement.field === id)
        ? { ...section, fields: section.fields.filter((placement) => placement.field !== id) }
        : section
    ),
    fields: { ...config.fields }
  };
  delete next.fields[id];
  const texts: Record<string, ITextElement> = { ...(config.texts ?? {}) };
  delete texts[id];
  if (Object.keys(texts).length > 0) {
    next.texts = texts;
  } else {
    delete next.texts;
  }
  return next;
}

/** A konfiguráció `texts` részének ellenőrzése; hibás tartalomra kivételt dob (a parseConfig kezeli). */
export function parseTexts(input: unknown, path: string): Record<string, ITextElement> | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!isRecord(input)) {
    throw new Error(format(engineStrings().MustBeObject, path));
  }
  const texts: Record<string, ITextElement> = {};
  Object.keys(input).forEach((id) => {
    const item: unknown = input[id];
    if (!TEXT_ID.test(id) || !isRecord(item) || typeof item.name !== 'string') {
      throw new Error(format(engineStrings().InvalidText, `${path}.${id}`));
    }
    const text: ITextElement = { name: item.name };
    if (typeof item.content === 'string' && item.content !== '') {
      text.content = item.content;
    }
    texts[id] = text;
  });
  return Object.keys(texts).length > 0 ? texts : undefined;
}
