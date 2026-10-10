// A motor üzenetei. A motor nem importálhatja az SPFx lokalizációs modult, ezért a szövegeket
// a belépési pont adja át (setEngineStrings). Alapértelmezés: angol, így a motor SPFx nélkül is tesztelhető.
// Új üzenetnél a loc/ fájlok `Engine` részét és a loc/myStrings.d.ts-t is bővíteni kell.

export interface IEngineStrings {
  ConditionRoot: string;
  MustBeObject: string;
  MustBeArray: string;
  MissingField: string;
  UnknownOperator: string;
  InNeedsArray: string;
  ValueMustBeScalar: string;
  InvalidJson: string;
  RootMustBeObject: string;
  UnknownSchemaVersion: string;
  InvalidModes: string;
  DuplicateSectionId: string;
  InvalidColor: string;
  InvalidNumber: string;
  InvalidOption: string;
  InvalidListId: string;
  InvalidFieldName: string;
}

const DEFAULT_STRINGS: IEngineStrings = {
  ConditionRoot: 'condition',
  MustBeObject: '{0}: must be an object.',
  MustBeArray: '{0}: must be an array.',
  MissingField: '{0}: "field" (the internal name of the field) is missing.',
  UnknownOperator: '{0}: unknown operator ({1}).',
  InNeedsArray: '{0}: the "value" of the "in" operator must be an array.',
  ValueMustBeScalar: '{0}: "value" must be a string, a number or a boolean.',
  InvalidJson: 'Invalid JSON: {0}',
  RootMustBeObject: 'The root of the configuration must be an object.',
  UnknownSchemaVersion: 'Unknown schema version: {0}.',
  InvalidModes: '{0}: the allowed values are new, edit, display.',
  DuplicateSectionId: 'The section id is not unique: {0}.',
  InvalidColor: '{0}: must be a hex color (#rgb or #rrggbb).',
  InvalidNumber: '{0}: must be a number between {1} and {2}.',
  InvalidOption: '{0}: the allowed values are {1}.',
  InvalidListId: '{0}: must be a list id (GUID).',
  InvalidFieldName: '{0}: must be the internal name of a field.'
};

let current: IEngineStrings = DEFAULT_STRINGS;

export function setEngineStrings(strings: IEngineStrings): void {
  current = strings;
}

export function engineStrings(): IEngineStrings {
  return current;
}

/** `{0}`, `{1}` … helyőrzők behelyettesítése. */
export function format(template: string, ...args: Array<string | number>): string {
  return template.replace(/\{(\d+)\}/g, (match: string, index: string) => {
    const value: string | number | undefined = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}
