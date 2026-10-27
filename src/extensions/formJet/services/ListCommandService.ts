// A lista helyi menüjének FormJet menüpontjai: a konfiguráció olvasása és mentése, a menüpontok bekötése a listára
// (egyéni művelet), és egy menüpont lépéseinek végrehajtása a kijelölt elemen.

import '@pnp/sp/user-custom-actions';

import { isActionComplete, parseListCommands, resolveTemplate } from '../engine/ListCommands';
import { resolveFieldValue } from '../engine/LayoutResolver';
import { buildRelatedViewXml, ID_FIELD, MAX_ROW_LIMIT } from '../engine/RelatedList';
import { ICurrentUser } from '../engine/UserValue';
import { FormValues, IFieldSchema } from '../models/IFieldSchema';
import {
  IFieldAssignment,
  IListCommand,
  IListCommandsConfig,
  LIST_COMMANDS_KEY,
  LIST_COMMANDS_SCHEMA_VERSION
} from '../models/IListCommands';
import * as ConfigService from './ConfigService';
import * as ItemService from './ItemService';
import * as RelatedListService from './RelatedListService';
import * as SchemaService from './SchemaService';
import { getSP } from './sp';

/** A FormJet Command Set összetevő azonosítója (FormJetCommandSet.manifest.json `id`). */
export const COMMAND_SET_COMPONENT_ID: string = '5c747283-23d4-484c-9ac2-421347d0a57d';

/** A lista helyi menüjébe kerülő egyéni művelet helye. */
const CONTEXT_MENU_LOCATION: string = 'ClientSideExtension.ListViewCommandSet.ContextMenu';
const CUSTOM_ACTION_TITLE: string = 'FormJet menüpontok';

export interface IListCommandsLoadResult extends ConfigService.IConfigRef {
  /** Hiányzik, ha nincs mentett konfiguráció. */
  config?: IListCommandsConfig;
  /** A konfigurációs lista nem érhető el, vagy a mentett JSON hibás. */
  warning?: string;
}

export function emptyConfig(listId: string): IListCommandsConfig {
  return { schemaVersion: LIST_COMMANDS_SCHEMA_VERSION, listId, commands: [] };
}

export async function load(listId: string): Promise<IListCommandsLoadResult> {
  const entry: ConfigService.IConfigEntry = await ConfigService.loadEntry(listId, LIST_COMMANDS_KEY);
  if (entry.warning || entry.raw === undefined) {
    return { warning: entry.warning };
  }
  const parsed = parseListCommands(entry.raw);
  return parsed.config
    ? { itemId: entry.itemId, etag: entry.etag, config: parsed.config }
    : { itemId: entry.itemId, etag: entry.etag, warning: parsed.error };
}

export function save(config: IListCommandsConfig, ref: ConfigService.IConfigRef, listTitle: string): Promise<ConfigService.IConfigRef> {
  return ConfigService.saveEntry(
    config.listId,
    LIST_COMMANDS_KEY,
    `${listTitle} – menüpontok`,
    JSON.stringify(config, undefined, 2),
    ref
  );
}

interface ICustomAction {
  Id: string;
  ClientSideComponentId?: string;
}

function normalizeGuid(value: string | undefined): string {
  return (value ?? '').replace(/[{}]/g, '').toLowerCase();
}

/** A lista FormJet menüpont-egyéni műveletei. */
async function getCustomActions(listId: string): Promise<ICustomAction[]> {
  const actions = (await getSP()
    .web.lists.getById(listId)
    .userCustomActions.select('Id', 'ClientSideComponentId')()) as ICustomAction[];
  return actions.filter((action) => normalizeGuid(action.ClientSideComponentId) === COMMAND_SET_COMPONENT_ID);
}

/** Be van-e kötve a listára a FormJet helyi menü. */
export async function isEnabled(listId: string): Promise<boolean> {
  return (await getCustomActions(listId)).length > 0;
}

/**
 * A FormJet helyi menü be- vagy kikötése a listán (listaszintű egyéni művelet). Csak a FormJet saját egyéni műveletét
 * hozza létre, illetve törli; a lista más beállításához nem nyúl.
 */
export async function setEnabled(listId: string, enabled: boolean): Promise<void> {
  const existing: ICustomAction[] = await getCustomActions(listId);
  const list = getSP().web.lists.getById(listId);
  if (enabled) {
    if (existing.length === 0) {
      // A PnPjs típusa nem ismeri az SPFx-összetevőre mutató mezőket, a REST felület igen.
      const info: Record<string, string> = {
        Title: CUSTOM_ACTION_TITLE,
        Location: CONTEXT_MENU_LOCATION,
        ClientSideComponentId: COMMAND_SET_COMPONENT_ID,
        ClientSideComponentProperties: '{}'
      };
      await list.userCustomActions.add(info as Parameters<typeof list.userCustomActions.add>[0]);
    }
    return;
  }
  for (let i: number = 0; i < existing.length; i++) {
    await list.userCustomActions.getById(existing[i].Id).delete();
  }
}

/** A futás eredménye a visszajelzéshez. */
export interface ICommandRunResult {
  /** A kijelölt elemen beállított mezők száma. */
  updatedFields: number;
  /** A másik listában módosított elemek száma. */
  updatedItems: number;
  /** A létrehozott új elemek száma. */
  createdItems: number;
}

export interface ICommandRunContext {
  /** A web kultúrája (dátum- és számformátum). */
  culture: string;
  currentUser: ICurrentUser;
}

/** A mentés mezőnkénti hibáiból egy hibaüzenet. */
function saveError(errors: Record<string, string>): Error | undefined {
  const names: string[] = Object.keys(errors);
  return names.length === 0 ? undefined : new Error(names.map((name) => `${name}: ${errors[name]}`).join('; '));
}

/** Egy lista sémája (az alapértelmezett tartalomtípus szerint), a menüpont lépéseinek cél listájához. */
async function listSchema(listId: string): Promise<IFieldSchema[]> {
  return SchemaService.getFields(listId, await SchemaService.resolveContentTypeId(listId, undefined));
}

/** A mezőértékek form-stringként a cél lista sémája szerint (a kijelölt elem értékeiből és a `[today]` / `[me]`-ből). */
function resolveAssignments(
  assignments: IFieldAssignment[],
  schema: IFieldSchema[],
  source: FormValues,
  context: ICommandRunContext
): FormValues {
  const values: FormValues = {};
  const now: Date = new Date();
  assignments.forEach((assignment) => {
    const field: IFieldSchema | undefined = schema.filter((item) => item.InternalName === assignment.field)[0];
    // A félkész vagy időközben törölt mező kimarad.
    if (!field) {
      return;
    }
    values[field.InternalName] = resolveFieldValue(field, resolveTemplate(assignment.value, source), context.culture, now, context.currentUser);
  });
  return values;
}

/** A lista azon elemeinek azonosítói, amelyek `matchField` mezője egyezik az értékkel. */
async function findMatchingItems(listId: string, matchField: string, value: string | undefined): Promise<number[]> {
  const fields: RelatedListService.IListFieldInfo[] = await RelatedListService.getListFields(listId);
  const match: RelatedListService.IListFieldInfo | undefined = fields.filter((field) => field.name === matchField)[0];
  if (!match) {
    throw new RelatedListService.RelatedMatchFieldError(matchField);
  }
  const viewXml: string | undefined = buildRelatedViewXml(
    { listId, matchField, sourceField: ID_FIELD, columns: [], rowLimit: MAX_ROW_LIMIT },
    match.type,
    value
  );
  if (!viewXml) {
    return [];
  }
  const data = (await getSP().web.lists.getById(listId).renderListDataAsStream({ ViewXml: viewXml })) as {
    Row?: Array<Record<string, unknown>>;
  };
  return (data.Row ?? []).map((row) => parseInt(String(row[ID_FIELD]), 10)).filter((id) => !isNaN(id));
}

/**
 * Egy menüpont lépéseinek végrehajtása a kijelölt elemen, sorban, egymás után. Hiba esetén a futás megáll (a már
 * elvégzett lépések megmaradnak), és a hiba a hívóhoz kerül.
 */
export async function run(listId: string, itemId: number, command: IListCommand, context: ICommandRunContext): Promise<ICommandRunResult> {
  const item = await ItemService.load(listId, itemId);
  const contentTypeId: string = await SchemaService.resolveContentTypeId(listId, item.contentTypeId);
  const schema: IFieldSchema[] = await SchemaService.getFields(listId, contentTypeId);
  const loaded = await ItemService.loadEditableValues(listId, itemId, schema);
  let source: FormValues = { ...loaded.values, [ID_FIELD]: String(itemId) };
  const result: ICommandRunResult = { updatedFields: 0, updatedItems: 0, createdItems: 0 };

  for (const action of command.actions) {
    if (!isActionComplete(action)) {
      continue;
    }
    if (action.type === 'setValue') {
      const values: FormValues = resolveAssignments([{ field: action.field, value: action.value }], schema, source, context);
      if (Object.keys(values).length === 0) {
        continue;
      }
      const saved = await ItemService.save({ listId, itemId }, values);
      const error: Error | undefined = saveError(saved.errors);
      if (error) {
        throw error;
      }
      // A további lépések már az új értéket látják.
      source = { ...source, ...values };
      result.updatedFields += Object.keys(values).length;
    } else if (action.type === 'updateItems') {
      const targetSchema: IFieldSchema[] = await listSchema(action.listId);
      const values: FormValues = resolveAssignments(action.values, targetSchema, source, context);
      const ids: number[] = await findMatchingItems(action.listId, action.matchField, source[action.sourceField]);
      for (const id of ids) {
        const saved = await ItemService.save({ listId: action.listId, itemId: id }, values);
        const error: Error | undefined = saveError(saved.errors);
        if (error) {
          throw error;
        }
        result.updatedItems++;
      }
    } else {
      const targetContentTypeId: string = await SchemaService.resolveContentTypeId(action.listId, undefined);
      const targetSchema: IFieldSchema[] = await SchemaService.getFields(action.listId, targetContentTypeId);
      const values: FormValues = resolveAssignments(action.values, targetSchema, source, context);
      const root = (await getSP().web.lists.getById(action.listId).rootFolder.select('ServerRelativeUrl')()) as {
        ServerRelativeUrl: string;
      };
      const saved = await ItemService.save(
        { listId: action.listId, contentTypeId: targetContentTypeId, folderPath: root.ServerRelativeUrl },
        values
      );
      const error: Error | undefined = saveError(saved.errors);
      if (error) {
        throw error;
      }
      result.createdItems++;
    }
  }
  return result;
}

/**
 * A kijelölt elem értékei a menüpontok láthatóságához (a mentett form-string értékek, a létrehozó azonosítója).
 */
export async function loadItemForVisibility(listId: string, itemId: number): Promise<{ values: FormValues; authorId?: number }> {
  const item = await ItemService.load(listId, itemId);
  const contentTypeId: string = await SchemaService.resolveContentTypeId(listId, item.contentTypeId);
  const schema: IFieldSchema[] = await SchemaService.getFields(listId, contentTypeId);
  const loaded = await ItemService.loadEditableValues(listId, itemId, schema);
  return { values: { ...loaded.values, [ID_FIELD]: String(itemId) }, authorId: loaded.authorId };
}
