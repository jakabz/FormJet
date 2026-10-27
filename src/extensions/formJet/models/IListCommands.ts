// A lista helyi menüjébe kerülő FormJet menüpontok konfigurációja (a FormJetCommandSet összetevőhöz).
// Listánként egy konfiguráció, a FormConfigurations listában tárolva (a tartalomtípus helyén a LIST_COMMANDS_KEY).
// Séma módosításakor: schemaVersion emelés + migráció a parseListCommands-ban (engine/ListCommands.ts).

import { Condition } from './IFormConfig';

export const LIST_COMMANDS_SCHEMA_VERSION: 1 = 1;

/** A konfigurációs listában a tartalomtípus azonosítója helyén álló kulcs (nem ütközhet tartalomtípus-azonosítóval). */
export const LIST_COMMANDS_KEY: string = 'listcommands';

/** Ennyi menüpont-hely van a Command Set manifestjében (COMMAND_1 … COMMAND_10); ennyi menüpont lehet listánként. */
export const LIST_COMMAND_SLOTS: number = 10;

/**
 * Egy mező értékének megadása. Az érték lehet konstans, `[today]` / `[me]` (a cél mező típusa szerint), vagy a kijelölt
 * elem egy mezője kapcsos zárójelben (`{Title}`). Ha az érték pontosan egy `{Mező}`, a mező form-stringje változatlanul
 * kerül át (így személy, keresőmező, dátum is másolható); szöveg közben a hivatkozás szövegként helyettesítődik.
 */
export interface IFieldAssignment {
  /** A cél mező InternalName-je. */
  field: string;
  value: string;
}

/** Egy menüpont lépése. */
export type ListCommandAction =
  /** A kijelölt elem egy mezőjének beállítása. */
  | { type: 'setValue'; field: string; value: string }
  /** Egy másik lista azon elemeinek módosítása, amelyek `matchField` mezője egyezik a kijelölt elem `sourceField` értékével. */
  | { type: 'updateItems'; listId: string; matchField: string; sourceField: string; values: IFieldAssignment[] }
  /** Új elem felvétele egy másik listába. */
  | { type: 'createItem'; listId: string; values: IFieldAssignment[] };

export type ListCommandActionType = ListCommandAction['type'];

export const LIST_COMMAND_ACTION_TYPES: ListCommandActionType[] = ['setValue', 'updateItems', 'createItem'];

export interface IListCommand {
  /** Stabil azonosító (`cmd:1`, …). */
  id: string;
  /** A menüpont felirata. */
  title: string;
  /**
   * Mikor látszik a menüpont a kijelölt elemnél. A feltétel a kijelölt elem mentett értékeire, a csoporttagságra
   * (`[Group:<azonosító>]`) és az `[IsAuthor]`-ra épülhet. Hiányában mindig látszik.
   */
  visibleWhen?: Condition;
  /** A megerősítő kérdés; hiányában általános szöveg. */
  confirm?: string;
  /** A sikeres futás utáni üzenet; hiányában általános szöveg. */
  successMessage?: string;
  /** Sorban, egymás után lefutó lépések. */
  actions: ListCommandAction[];
}

export interface IListCommandsConfig {
  schemaVersion: 1;
  listId: string;
  commands: IListCommand[];
}
