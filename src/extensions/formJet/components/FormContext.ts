// A form egészére érvényes adatok, amelyeket a mezővezérlők prop-drilling nélkül érnek el.

import * as React from 'react';

import { ICurrentUser } from '../engine/UserValue';
import { FormValues } from '../models/IFieldSchema';
import { ButtonAction } from '../models/IFormConfig';
import { IFieldAssignment } from '../models/IListCommands';
import { IAttachmentFile } from '../services/AttachmentService';

/** A mellékletek állapota a formon; a változások a form mentésekor hajtódnak végre. */
export interface IAttachmentsState {
  /** Az elemhez már feltöltött fájlok. */
  existing: IAttachmentFile[];
  /** Hozzáadásra váró fájlok. */
  added: File[];
  /** A meglévők közül törlésre jelölt fájlok neve. */
  removed: string[];
}

export const EMPTY_ATTACHMENTS: IAttachmentsState = { existing: [], added: [], removed: [] };

export interface IFormContext {
  /** A web területi beállításainak kultúrája (pl. hu-HU): a dátum form-string formátumát határozza meg. */
  cultureName: string;
  /** A felület nyelve (pl. en-US): a naptár hónap- és napnevei ezen jelennek meg. */
  uiCultureName: string;
  /** A megnyitott elem azonosítója; új elemnél nincs. */
  itemId?: number;
  /** Az elem betöltéskori (mentett) form-string értékei: a kapcsolódó elemek párosításának alapja. */
  sourceValues: FormValues;
  attachments: IAttachmentsState;
  setAttachments: (next: IAttachmentsState) => void;
  /** A lista szerverrelatív címe (a mellékletként tárolt képek címéhez). */
  listUrl?: string;
  /** Kiválasztott, de még fel nem töltött képek, a mező InternalName-je szerint. */
  pendingImages: Record<string, File>;
  setPendingImage: (fieldName: string, file: File | undefined) => void;
  /** A gomb műveleteinek futtatása (sorban, egymás után); a tervező előnézetében nem hívódik. */
  runButtonActions: (actions: ButtonAction[]) => Promise<void>;
  /** Mentés folyamatban: a gombok ilyenkor tiltottak. */
  busy: boolean;
  /** A bejelentkezett felhasználó (a feladatok `[me]` értékéhez). */
  currentUser?: ICurrentUser;
  /**
   * A kapcsolódó feladatok gombszabályaihoz: az elem mentett értékei és a környezeti változók (a form módja,
   * csoporttagság, létrehozó, változók).
   */
  itemConditionValues: FormValues;
  /**
   * A feladat gombjával beállított mezők mentése az elemen (csak ezek; az űrlap nem mentett módosításai nem). Utána az
   * űrlap a mentett értékeket újratölti, a nem mentett módosítások megmaradnak.
   */
  applyItemValues: (values: IFieldAssignment[]) => Promise<void>;
}

export const FormContext: React.Context<IFormContext> = React.createContext<IFormContext>({
  cultureName: 'en-US',
  uiCultureName: 'en-US',
  sourceValues: {},
  attachments: EMPTY_ATTACHMENTS,
  setAttachments: () => undefined,
  pendingImages: {},
  setPendingImage: () => undefined,
  runButtonActions: () => Promise.resolve(),
  busy: false,
  itemConditionValues: {},
  applyItemValues: () => Promise.resolve()
});
