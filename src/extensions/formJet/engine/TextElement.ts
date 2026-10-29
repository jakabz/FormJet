// Mező nélküli elemek: felirat (a formon megjelenő sima szöveg), gomb (egy cím megnyitására vagy lépések futtatására) és
// kapcsolódó elemek (egy másik lista párosított elemei), amelyek mögött nincs SharePoint mező. A sémában pszeudo-mezőként szerepelnek (mint a mellékletek), így a szekciókban ugyanúgy
// elhelyezhetők és áthelyezhetők, mint a mezők. Értékük nincs, ezért soha nem kerülnek a mentésbe.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

import { IFieldSchema } from '../models/IFieldSchema';
import { IFieldConfig, IFormConfig, ITextElement, LayoutElementKind } from '../models/IFormConfig';
import { isIconName, parseButtonActions } from './ButtonAction';
import { engineStrings, format } from './EngineStrings';
import { ID_FIELD, parseRelated } from './RelatedList';

/** A felirat (szövegelem) pszeudo-mezőjének típusa a sémában. */
export const TEXT_ELEMENT_TYPE: string = 'FormJetText';
/** A gomb pszeudo-mezőjének típusa a sémában. */
export const BUTTON_ELEMENT_TYPE: string = 'FormJetButton';
/** A kapcsolódó elemek pszeudo-mezőjének típusa a sémában. */
export const RELATED_ELEMENT_TYPE: string = 'FormJetRelated';

const ELEMENT_TYPES: Record<LayoutElementKind, string> = {
  text: TEXT_ELEMENT_TYPE,
  button: BUTTON_ELEMENT_TYPE,
  related: RELATED_ELEMENT_TYPE
};

/** Az azonosító előtagja fajtánként. A kettőspont miatt az azonosító nem ütközhet SharePoint mező belső nevével. */
const ID_PREFIXES: Record<LayoutElementKind, string> = { text: 'text:', button: 'button:', related: 'related:' };
const ELEMENT_ID: RegExp = /^(text|button|related):[A-Za-z0-9_-]+$/;

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

export function isRelatedElement(schema: IFieldSchema): boolean {
  return schema.TypeAsString === RELATED_ELEMENT_TYPE;
}

/** Mező nélküli elem (felirat, gomb, kapcsolódó elemek): nincs értéke, feltétel nem hivatkozhat rá, és nem kerül a mentésbe. */
export function isLayoutElement(schema: IFieldSchema): boolean {
  return isTextElement(schema) || isButtonElement(schema) || isRelatedElement(schema);
}

/** Az elem fajtája az azonosítója előtagjából. */
function kindOfId(id: string): LayoutElementKind {
  return id.indexOf(ID_PREFIXES.button) === 0 ? 'button' : id.indexOf(ID_PREFIXES.related) === 0 ? 'related' : 'text';
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
      TypeAsString: ELEMENT_TYPES[texts[id].kind ?? 'text'],
      Required: false,
      ReadOnlyField: true
    }))
  );
}

/**
 * Új felirat, gomb vagy kapcsolódó elemek a megadott megnevezéssel. A megadott szekció végére kerül (a kapcsolódó elemek
 * teljes szélességben); ha nincs ilyen szekció, az utolsóéra, szekció nélkül pedig nem elhelyezett elem marad.
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
  const element: ITextElement =
    kind === 'related'
      ? { kind, name, related: { listId: '', matchField: '', sourceField: ID_FIELD, columns: [] } }
      : kind === 'button'
        ? { kind, name }
        : { name };
  const target: string | undefined = config.sections.some((section) => section.id === sectionId)
    ? sectionId
    : config.sections[config.sections.length - 1]?.id;
  return {
    id,
    config: {
      ...config,
      texts: { ...texts, [id]: element },
      sections: config.sections.map((section) =>
        section.id === target
          ? {
              ...section,
              fields: [...section.fields, kind === 'related' && section.columns > 1 ? { field: id, colSpan: section.columns } : { field: id }]
            }
          : section
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
  // Az alsó gombsorból is kikerül (a gombsor üresen is megmarad: ilyenkor nincs alsó gomb).
  if (config.footer) {
    next.footer = config.footer.filter((item) => item !== id);
  }
  if (Object.keys(texts).length > 0) {
    next.texts = texts;
  } else {
    delete next.texts;
  }
  return next;
}

/** Feliratok az alapértelmezett alsó gombsorhoz (a motor nem importálhatja a lokalizációt, a hívó adja át). */
export interface IFooterCaptions {
  save: string;
  saveAndClose: string;
  cancel: string;
  close: string;
}

/** Új gomb az alsó gombsor végére. */
export function addFooterButton(config: IFormConfig, name: string): { config: IFormConfig; id: string } {
  const texts: Record<string, ITextElement> = config.texts ?? {};
  let n: number = Object.keys(texts).filter((key) => key.indexOf(ID_PREFIXES.button) === 0).length + 1;
  while (texts[`${ID_PREFIXES.button}${n}`]) {
    n++;
  }
  const id: string = `${ID_PREFIXES.button}${n}`;
  return {
    id,
    config: { ...config, texts: { ...texts, [id]: { kind: 'button', name } }, footer: [...(config.footer ?? []), id] }
  };
}

/**
 * Az alsó gombsor testreszabása: a `saveMode` szerinti beépített gombok gombelemként a konfigurációba kerülnek,
 * ugyanazzal a viselkedéssel. Alapértelmezett: Mentés (ment és bezár) + Mégse; bővített: Mentés (nyitva marad) +
 * Mentés és bezárás + Mégse. A mentő gombok megtekintéskor nem látszanak, a Mégse felirata ott „Bezárás”.
 */
export function createDefaultFooter(config: IFormConfig, captions: IFooterCaptions): IFormConfig {
  let next: IFormConfig = { ...config };
  const ids: string[] = [];
  const add = (name: string, element: Partial<ITextElement>, field: IFieldConfig): void => {
    const added = addFooterButton(next, name);
    next = {
      ...added.config,
      texts: { ...(added.config.texts ?? {}), [added.id]: { kind: 'button', name, ...element } },
      fields: { ...added.config.fields, [added.id]: field }
    };
    ids.push(added.id);
  };
  const saving: IFieldConfig = { visibleIn: ['new', 'edit'] };
  if (config.saveMode === 'extended') {
    add(captions.save, { primary: true, actions: [{ type: 'save', keepOpen: true }] }, saving);
    add(captions.saveAndClose, { primary: true, actions: [{ type: 'save' }] }, saving);
  } else {
    add(captions.save, { primary: true, actions: [{ type: 'save' }] }, saving);
  }
  add(captions.cancel, { actions: [{ type: 'close' }] }, {
    conditional: { label: [{ when: { field: '[IsDisplayMode]', op: 'eq', value: true }, value: captions.close }] }
  });
  return { ...next, footer: [...(config.footer ?? []), ...ids] };
}

/** Vissza a beépített gombsorhoz: az alsó gombok (és a beállításaik) törlődnek. */
export function removeFooter(config: IFormConfig): IFormConfig {
  let next: IFormConfig = config;
  (config.footer ?? []).forEach((id) => {
    next = removeTextElement(next, id);
  });
  const result: IFormConfig = { ...next };
  delete result.footer;
  return result;
}

/** Az alsó gombsor ellenőrzése: csak létező gombelemek azonosítói maradnak, ismétlés nélkül. */
export function parseFooter(input: unknown, texts: Record<string, ITextElement> | undefined, path: string): string[] | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!Array.isArray(input)) {
    throw new Error(format(engineStrings().MustBeArray, path));
  }
  const ids: string[] = [];
  input.forEach((id: unknown) => {
    if (typeof id === 'string' && texts?.[id]?.kind === 'button' && ids.indexOf(id) === -1) {
      ids.push(id);
    }
  });
  return ids;
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
    // A fajta és az azonosító előtagja összetartozik (`button:` ↔ `kind: button`, `related:` ↔ `kind: related`).
    const kind: LayoutElementKind = kindOfId(id);
    const isButton: boolean = kind === 'button';
    if (
      !ELEMENT_ID.test(id) ||
      !isRecord(item) ||
      typeof item.name !== 'string' ||
      (item.kind ?? 'text') !== kind
    ) {
      throw new Error(format(engineStrings().InvalidText, `${path}.${id}`));
    }
    if (kind === 'related') {
      texts[id] = {
        kind,
        name: item.name,
        related: parseRelated(item.related, `${path}.${id}.related`) ?? {
          listId: '',
          matchField: '',
          sourceField: ID_FIELD,
          columns: []
        }
      };
      return;
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
    if (isButton && item.primary === true) {
      text.primary = true;
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
