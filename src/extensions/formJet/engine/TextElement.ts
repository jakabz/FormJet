// Mező nélküli elemek: felirat (a formon megjelenő sima szöveg) és gomb (egy cím megnyitására), amelyek mögött nincs
// SharePoint mező. A sémában pszeudo-mezőként szerepelnek (mint a mellékletek), így a szekciókban ugyanúgy
// elhelyezhetők és áthelyezhetők, mint a mezők. Értékük nincs, ezért soha nem kerülnek a mentésbe.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

import { IFieldSchema } from '../models/IFieldSchema';
import { IFormConfig, ITextElement, LayoutElementKind } from '../models/IFormConfig';
import { isIconName, parseButtonActions } from './ButtonAction';
import { engineStrings, format } from './EngineStrings';

/** A felirat (szövegelem) pszeudo-mezőjének típusa a sémában. */
export const TEXT_ELEMENT_TYPE: string = 'FormJetText';
/** A gomb pszeudo-mezőjének típusa a sémában. */
export const BUTTON_ELEMENT_TYPE: string = 'FormJetButton';

/** Az azonosító előtagja fajtánként. A kettőspont miatt az azonosító nem ütközhet SharePoint mező belső nevével. */
const ID_PREFIXES: Record<LayoutElementKind, string> = { text: 'text:', button: 'button:' };
const ELEMENT_ID: RegExp = /^(text|button):[A-Za-z0-9_-]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Felirat (sima szöveg). */
export function isTextElement(schema: IFieldSchema): boolean {
  return schema.TypeAsString === TEXT_ELEMENT_TYPE;
}

export function isButtonElement(schema: IFieldSchema): boolean {
  return schema.TypeAsString === BUTTON_ELEMENT_TYPE;
}

/** Mező nélküli elem (felirat vagy gomb): nincs értéke, feltétel nem hivatkozhat rá, és nem kerül a mentésbe. */
export function isLayoutElement(schema: IFieldSchema): boolean {
  return isTextElement(schema) || isButtonElement(schema);
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
      TypeAsString: texts[id].kind === 'button' ? BUTTON_ELEMENT_TYPE : TEXT_ELEMENT_TYPE,
      Required: false,
      ReadOnlyField: true
    }))
  );
}

/**
 * Új felirat vagy gomb a megadott megnevezéssel. A megadott szekció végére kerül; ha nincs ilyen szekció, az utolsóéra,
 * szekció nélkül pedig nem elhelyezett elem marad.
 */
export function addTextElement(
  config: IFormConfig,
  name: string,
  sectionId?: string,
  kind: LayoutElementKind = 'text'
): { config: IFormConfig; id: string } {
  const texts: Record<string, ITextElement> = config.texts ?? {};
  const prefix: string = ID_PREFIXES[kind];
  let n: number = Object.keys(texts).filter((key) => key.indexOf(prefix) === 0).length + 1;
  while (texts[`${prefix}${n}`]) {
    n++;
  }
  const id: string = `${prefix}${n}`;
  const element: ITextElement = kind === 'button' ? { kind, name } : { name };
  const target: string | undefined = config.sections.some((section) => section.id === sectionId)
    ? sectionId
    : config.sections[config.sections.length - 1]?.id;
  return {
    id,
    config: {
      ...config,
      texts: { ...texts, [id]: element },
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
    // A fajta és az azonosító előtagja összetartozik (`button:` ↔ `kind: button`).
    const isButton: boolean = id.indexOf(ID_PREFIXES.button) === 0;
    if (
      !ELEMENT_ID.test(id) ||
      !isRecord(item) ||
      typeof item.name !== 'string' ||
      (item.kind !== undefined && item.kind !== 'text' && item.kind !== 'button') ||
      (item.kind === 'button') !== isButton
    ) {
      throw new Error(format(engineStrings().InvalidText, `${path}.${id}`));
    }
    const text: ITextElement = isButton ? { kind: 'button', name: item.name } : { name: item.name };
    if (!isButton && typeof item.content === 'string' && item.content !== '') {
      text.content = item.content;
    }
    if (isButton && typeof item.url === 'string' && item.url.trim() !== '') {
      text.url = item.url.trim();
    }
    if (isButton && item.newTab === true) {
      text.newTab = true;
    }
    // A hibás ikonnév nem teszi érvénytelenné az elrendezést: egyszerűen kimarad (a tervező jelzi).
    if (isButton && isIconName(item.icon)) {
      text.icon = item.icon;
    }
    const actions = isButton ? parseButtonActions(item.actions, `${path}.${id}.actions`) : undefined;
    if (actions) {
      text.actions = actions;
    }
    texts[id] = text;
  });
  return Object.keys(texts).length > 0 ? texts : undefined;
}
