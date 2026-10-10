// Konfiguráció olvasása / mentése a FormConfigurations listában, ETag-gel.

import * as strings from 'FormJetFormCustomizerStrings';

import { format } from '../engine/EngineStrings';
import { parseConfig } from '../engine/LayoutResolver';
import { IFormConfig } from '../models/IFormConfig';
import { getHttpStatus, getSP } from './sp';

export const CONFIG_LIST_TITLE: string = 'FormConfigurations';

const FIELD_LIST_ID: string = 'FormJetListId';
const FIELD_CONTENT_TYPE_ID: string = 'FormJetContentTypeId';
const FIELD_CONFIG: string = 'FormJetConfig';

/** Más közben mentette a konfigurációt (HTTP 412). */
export class ConfigConflictError extends Error {
  public constructor() {
    super('The configuration was modified by someone else.');
    Object.setPrototypeOf(this, ConfigConflictError.prototype);
  }
}

/** A felhasználónak nincs írási joga a FormConfigurations listán (HTTP 403). */
export class ConfigAccessDeniedError extends Error {
  public constructor() {
    super('Access denied to the configuration list.');
    Object.setPrototypeOf(this, ConfigAccessDeniedError.prototype);
  }
}

export interface IConfigRef {
  itemId?: number;
  etag?: string;
}

export interface IConfigLoadResult extends IConfigRef {
  /** Hiányzik, ha nincs mentett konfiguráció, vagy az hibás. */
  config?: IFormConfig;
  /** Adminnak szóló figyelmeztetés: a lista nem érhető el, vagy a mentett JSON hibás. */
  warning?: string;
}

interface IConfigItem {
  Id: number;
  FormJetConfig?: string;
  'odata.etag'?: string;
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export async function load(listId: string, contentTypeId: string): Promise<IConfigLoadResult> {
  let items: IConfigItem[];
  try {
    items = (await getSP()
      .web.lists.getByTitle(CONFIG_LIST_TITLE)
      .items.select('Id', FIELD_CONFIG)
      .filter(`${FIELD_LIST_ID} eq ${quote(listId)} and ${FIELD_CONTENT_TYPE_ID} eq ${quote(contentTypeId)}`)
      .top(1)()) as IConfigItem[];
  } catch {
    return { warning: format(strings.ConfigListUnavailable, CONFIG_LIST_TITLE) };
  }

  const item: IConfigItem | undefined = items[0];
  if (!item) {
    return {};
  }
  const ref: IConfigRef = { itemId: item.Id, etag: item['odata.etag'] };
  const parsed = parseConfig(item.FormJetConfig ?? '');
  if (!parsed.config) {
    return {
      ...ref,
      warning: format(strings.ConfigInvalid, parsed.error ?? '')
    };
  }
  return { ...ref, config: parsed.config };
}

/** Mentés ETag-gel. 412 → ConfigConflictError, 403 → ConfigAccessDeniedError. */
export async function save(config: IFormConfig, ref: IConfigRef): Promise<IConfigRef> {
  const list = getSP().web.lists.getByTitle(CONFIG_LIST_TITLE);
  const payload: Record<string, string> = {
    Title: config.title || `${config.listId} / ${config.contentTypeId}`,
    [FIELD_LIST_ID]: config.listId,
    [FIELD_CONTENT_TYPE_ID]: config.contentTypeId,
    [FIELD_CONFIG]: JSON.stringify(config, undefined, 2)
  };

  try {
    let itemId: number | undefined = ref.itemId;
    if (itemId !== undefined) {
      await list.items.getById(itemId).update(payload, ref.etag ?? '*');
    } else {
      const added = (await list.items.add(payload)) as { Id: number };
      itemId = added.Id;
    }
    const fresh = (await list.items.getById(itemId).select('Id')()) as IConfigItem;
    return { itemId, etag: fresh['odata.etag'] };
  } catch (e) {
    const status: number | undefined = getHttpStatus(e);
    if (status === 412) {
      throw new ConfigConflictError();
    }
    if (status === 403) {
      throw new ConfigAccessDeniedError();
    }
    throw e;
  }
}
