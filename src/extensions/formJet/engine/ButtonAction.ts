// A gomb műveletei: sorban lefutó lépések (mező értékének beállítása, mentés, bezárás).
// A végrehajtás a FormHost dolga; itt az ellenőrzés és a végrehajtási terv van.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

import { IFieldSchema } from '../models/IFieldSchema';
import { ButtonAction, BUTTON_ACTION_TYPES, ButtonActionType } from '../models/IFormConfig';
import { ATTACHMENTS_FIELD } from './Attachments';
import { engineStrings, format } from './EngineStrings';
import { isEditableField } from './LayoutResolver';

/** Fluent UI ikonnév: csak betűk és számok (így a konfigurációból nem kerülhet más a lapra). */
const ICON_NAME: RegExp = /^[A-Za-z0-9]{1,64}$/;

/** A mező belső neve: betűvel vagy aláhúzással kezdődik, utána betű, szám vagy aláhúzás. */
const FIELD_NAME: RegExp = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isIconName(value: unknown): value is string {
  return typeof value === 'string' && ICON_NAME.test(value);
}

/**
 * Beállíthatja-e a gomb a mező értékét: a SharePoint szerint írható, a form kezeli a típusát, és az értéke form-string
 * (a mellékletek és a kép feltöltést igényelnek). Az űrlapon rejtett vagy csak olvasható mező is ilyen lehet.
 */
export function isButtonSettableField(field: IFieldSchema): boolean {
  return isEditableField(field) && field.TypeAsString !== ATTACHMENTS_FIELD && field.TypeAsString !== 'Thumbnail';
}

/** A sort lezáró lépés: utána nem fut le több. */
export function endsSequence(type: ButtonActionType): boolean {
  return type === 'save' || type === 'close';
}

/**
 * A ténylegesen lefutó lépések: a sor az első mentésnél vagy bezárásnál véget ér (azt még beleértve).
 * A tervező ebből jelzi, ha egy lépés sosem futna le.
 */
export function effectiveActions(actions: ButtonAction[]): ButtonAction[] {
  const end: number = actions.findIndex((action) => endsSequence(action.type));
  return end === -1 ? actions : actions.slice(0, end + 1);
}

/** A konfiguráció `actions` részének ellenőrzése; hibás tartalomra kivételt dob (a parseConfig kezeli). */
export function parseButtonActions(input: unknown, path: string): ButtonAction[] | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!Array.isArray(input)) {
    throw new Error(format(engineStrings().MustBeArray, path));
  }
  const actions: ButtonAction[] = input.map((item: unknown, index: number) => {
    const itemPath: string = `${path}[${index}]`;
    if (!isRecord(item) || (BUTTON_ACTION_TYPES as unknown[]).indexOf(item.type) === -1) {
      throw new Error(format(engineStrings().InvalidOption, `${itemPath}.type`, BUTTON_ACTION_TYPES.join(', ')));
    }
    if (item.type === 'setValue') {
      // Az üres mező a tervezőben félkész lépés: megmarad, de futáskor kimarad.
      if (typeof item.field !== 'string' || (item.field !== '' && !FIELD_NAME.test(item.field))) {
        throw new Error(format(engineStrings().InvalidFieldName, `${itemPath}.field`));
      }
      return { type: 'setValue', field: item.field, value: typeof item.value === 'string' ? item.value : '' };
    }
    if (item.type === 'save') {
      return item.keepOpen === true ? { type: 'save', keepOpen: true } : { type: 'save' };
    }
    return { type: 'close' };
  });
  return actions.length > 0 ? actions : undefined;
}
