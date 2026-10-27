// A lista helyi menüjébe kerülő menüpontok: a konfiguráció ellenőrzése, a láthatóság kiértékelése és az értéksablonok.
// A végrehajtás a services/ListCommandService.ts dolga; kódot nem futtatunk, csak az előre megírt lépéstípusokat.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

import { FormValues } from '../models/IFieldSchema';
import { Condition } from '../models/IFormConfig';
import {
  IFieldAssignment,
  IListCommand,
  IListCommandsConfig,
  LIST_COMMAND_ACTION_TYPES,
  LIST_COMMAND_SLOTS,
  LIST_COMMANDS_SCHEMA_VERSION,
  ListCommandAction
} from '../models/IListCommands';
import { AUTHOR_VARIABLE, groupVariable, parseGroupVariable } from './ConditionContext';
import { evaluate, validateCondition } from './ConditionEngine';
import { engineStrings, format } from './EngineStrings';
import { mapCondition } from './FormVariables';
import { ID_FIELD, isFieldName, isListId } from './RelatedList';

const TRUE_VALUE: string = '1';
const FALSE_VALUE: string = '0';

/** A kijelölt elem mezőjére hivatkozó sablonrész: `{InternalName}`. */
const FIELD_REF: RegExp = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const WHOLE_FIELD_REF: RegExp = /^\{([A-Za-z_][A-Za-z0-9_]*)\}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface IParseListCommandsResult {
  config?: IListCommandsConfig;
  error?: string;
}

/** Új, egyedi menüpont-azonosító (`cmd:1`, `cmd:2`, …). */
export function newCommandId(commands: IListCommand[]): string {
  let n: number = commands.length + 1;
  while (commands.some((command) => command.id === `cmd:${n}`)) {
    n++;
  }
  return `cmd:${n}`;
}

/**
 * Az értéksablon feloldása a kijelölt elem form-string értékeiből. Ha a sablon pontosan egy `{Mező}`, a mező értéke
 * változatlanul kerül át; egyébként a hivatkozások szövegként helyettesítődnek. A `[today]` / `[me]` a cél mező típusa
 * szerint a végrehajtáskor alakul át (LayoutResolver.resolveFieldValue).
 */
export function resolveTemplate(template: string, source: FormValues): string {
  const whole: RegExpMatchArray | null = template.trim().match(WHOLE_FIELD_REF);
  if (whole) {
    return source[whole[1]] ?? '';
  }
  return template.replace(FIELD_REF, (_match: string, name: string) => source[name] ?? '');
}

/** A sablonban hivatkozott mezők (a kijelölt elemből), ismétlés nélkül. */
export function templateFields(template: string): string[] {
  const found: string[] = [];
  template.replace(FIELD_REF, (match: string, name: string) => {
    if (found.indexOf(name) === -1) {
      found.push(name);
    }
    return match;
  });
  return found;
}

/** A menüpontok feltételeiben hivatkozott SharePoint csoportok (a tagságot előre le kell kérdezni). */
export function collectCommandGroupIds(config: IListCommandsConfig): number[] {
  const found: number[] = [];
  config.commands.forEach((command) => {
    if (command.visibleWhen) {
      mapCondition(command.visibleWhen, (field) => {
        const groupId: number | undefined = parseGroupVariable(field.field);
        if (groupId !== undefined && found.indexOf(groupId) === -1) {
          found.push(groupId);
        }
        return field;
      });
    }
  });
  return found.sort((a, b) => a - b);
}

/**
 * Látszik-e a menüpont a kijelölt elemnél. A feltétel a kijelölt elem értékeit, a csoporttagságot és az `[IsAuthor]`-t
 * látja. Feltétel nélkül mindig látszik.
 */
export function isCommandVisible(
  command: IListCommand,
  itemValues: FormValues,
  memberGroupIds: number[],
  isAuthor: boolean
): boolean {
  if (!command.visibleWhen) {
    return true;
  }
  const values: FormValues = { ...itemValues, [AUTHOR_VARIABLE]: isAuthor ? TRUE_VALUE : FALSE_VALUE };
  mapCondition(command.visibleWhen, (field) => {
    const groupId: number | undefined = parseGroupVariable(field.field);
    if (groupId !== undefined) {
      values[groupVariable(groupId)] = memberGroupIds.indexOf(groupId) !== -1 ? TRUE_VALUE : FALSE_VALUE;
    }
    return field;
  });
  return evaluate(command.visibleWhen, values);
}

function parseAssignments(input: unknown, path: string): IFieldAssignment[] {
  if (input === undefined) {
    return [];
  }
  if (!Array.isArray(input)) {
    throw new Error(format(engineStrings().MustBeArray, path));
  }
  return input.map((item: unknown, index: number) => {
    const itemPath: string = `${path}[${index}]`;
    if (!isRecord(item)) {
      throw new Error(format(engineStrings().MustBeObject, itemPath));
    }
    // Az üres mező a szerkesztőben félkész sor: megmarad, de futáskor kimarad.
    if (typeof item.field !== 'string' || (item.field !== '' && !isFieldName(item.field))) {
      throw new Error(format(engineStrings().InvalidFieldName, `${itemPath}.field`));
    }
    return { field: item.field, value: typeof item.value === 'string' ? item.value : '' };
  });
}

/** A lista azonosítója: GUID, vagy a szerkesztőben még üres (félkész lépés). */
function parseListIdValue(value: unknown, path: string): string {
  if (value === undefined || value === '') {
    return '';
  }
  if (!isListId(value)) {
    throw new Error(format(engineStrings().InvalidListId, path));
  }
  return (value as string).toLowerCase();
}

function parseFieldValue(value: unknown, path: string, allowId: boolean = false): string {
  if (value === undefined || value === '') {
    return '';
  }
  if (typeof value !== 'string' || (!isFieldName(value) && !(allowId && value === ID_FIELD))) {
    throw new Error(format(engineStrings().InvalidFieldName, path));
  }
  return value;
}

function parseAction(input: unknown, path: string): ListCommandAction {
  if (!isRecord(input) || (LIST_COMMAND_ACTION_TYPES as unknown[]).indexOf(input.type) === -1) {
    throw new Error(format(engineStrings().InvalidOption, `${path}.type`, LIST_COMMAND_ACTION_TYPES.join(', ')));
  }
  if (input.type === 'setValue') {
    return { type: 'setValue', field: parseFieldValue(input.field, `${path}.field`), value: typeof input.value === 'string' ? input.value : '' };
  }
  if (input.type === 'updateItems') {
    return {
      type: 'updateItems',
      listId: parseListIdValue(input.listId, `${path}.listId`),
      matchField: parseFieldValue(input.matchField, `${path}.matchField`, true),
      sourceField: parseFieldValue(input.sourceField, `${path}.sourceField`, true),
      values: parseAssignments(input.values, `${path}.values`)
    };
  }
  return { type: 'createItem', listId: parseListIdValue(input.listId, `${path}.listId`), values: parseAssignments(input.values, `${path}.values`) };
}

function parseCommand(input: unknown, index: number): IListCommand {
  const path: string = `commands[${index}]`;
  if (!isRecord(input)) {
    throw new Error(format(engineStrings().MustBeObject, path));
  }
  const command: IListCommand = {
    id: typeof input.id === 'string' && input.id !== '' ? input.id : `cmd:${index + 1}`,
    title: typeof input.title === 'string' ? input.title : '',
    actions: []
  };
  if (input.visibleWhen !== undefined) {
    const error: string | undefined = validateCondition(input.visibleWhen, `${path}.visibleWhen`);
    if (error) {
      throw new Error(error);
    }
    command.visibleWhen = input.visibleWhen as Condition;
  }
  if (typeof input.confirm === 'string' && input.confirm !== '') {
    command.confirm = input.confirm;
  }
  if (typeof input.successMessage === 'string' && input.successMessage !== '') {
    command.successMessage = input.successMessage;
  }
  if (input.actions !== undefined) {
    if (!Array.isArray(input.actions)) {
      throw new Error(format(engineStrings().MustBeArray, `${path}.actions`));
    }
    command.actions = input.actions.map((action: unknown, i: number) => parseAction(action, `${path}.actions[${i}]`));
  }
  return command;
}

/** A tárolt JSON értelmezése és ellenőrzése; hibás tartalomra nem dob, hanem `error`-t ad vissza. */
export function parseListCommands(raw: string): IParseListCommandsResult {
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch (e) {
    return { error: format(engineStrings().InvalidJson, e instanceof Error ? e.message : String(e)) };
  }
  if (!isRecord(input)) {
    return { error: engineStrings().RootMustBeObject };
  }
  if (input.schemaVersion !== LIST_COMMANDS_SCHEMA_VERSION) {
    return { error: format(engineStrings().UnknownSchemaVersion, String(input.schemaVersion)) };
  }
  try {
    if (!Array.isArray(input.commands)) {
      throw new Error(format(engineStrings().MustBeArray, 'commands'));
    }
    // A Command Set manifestjében ennyi menüpont-hely van; a többi nem jelenhetne meg.
    const commands: IListCommand[] = input.commands.slice(0, LIST_COMMAND_SLOTS).map(parseCommand);
    return {
      config: {
        schemaVersion: LIST_COMMANDS_SCHEMA_VERSION,
        listId: typeof input.listId === 'string' ? input.listId : '',
        commands
      }
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Futtatható-e a lépés (a szerkesztőben félkész lépés kimarad). */
export function isActionComplete(action: ListCommandAction): boolean {
  switch (action.type) {
    case 'setValue':
      return action.field !== '';
    case 'updateItems':
      return action.listId !== '' && action.matchField !== '' && action.sourceField !== '';
    default:
      return action.listId !== '';
  }
}
