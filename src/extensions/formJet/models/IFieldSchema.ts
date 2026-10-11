// A SharePoint mezőséma formhoz szükséges része, és a form állapotának típusai.

export interface IFieldSchema {
  InternalName: string;
  Title: string;
  /** Pl. Text, Note, Number, Currency, Choice, MultiChoice, Boolean, DateTime, User, Lookup. */
  TypeAsString: string;
  Required: boolean;
  ReadOnlyField: boolean;
  Description?: string;
  DefaultValue?: string;
  Choices?: string[];
  FillInChoice?: boolean;
  MaxLength?: number;
  RichText?: boolean;
  NumberOfLines?: number;
  /** DateTime mezőnél: csak dátum (true) vagy dátum és idő (false). */
  DateOnly?: boolean;
  /** User mezőnél: csoport is választható-e (a mező „Személyek és csoportok” beállítása). */
  UserAllowGroups?: boolean;
  /** User mezőnél: ha a választás egy SharePoint csoport tagjaira van szűkítve, a csoport azonosítója. */
  UserSelectionGroup?: number;
  /** Lookup mezőnél: a hivatkozott lista GUID-ja; hiányzik, ha a mező nem listára mutat. */
  LookupListId?: string;
  /** Lookup mezőnél: a hivatkozott lista megjelenített mezőjének InternalName-je. */
  LookupField?: string;
  /** Number mezőnél: százalékként jelenik meg (az érték százalékban értendő, pl. `25`). */
  Percentage?: boolean;
  /** Currency mezőnél: a pénznem formátumának nyelvi azonosítója (LCID), pl. 1038 = magyar forint. */
  CurrencyLocaleId?: number;
  /** URL mezőnél: képként jelenik meg (a mező „Kép” formátuma), nem hivatkozásként. */
  UrlImage?: boolean;
  /** Kép (Thumbnail) mezőnél: a mező azonosítója (GUID); a feltöltött kép értékébe kerül. */
  FieldId?: string;
}

/** Mezőértékek form-string formátumban, InternalName szerint. */
export type FormValues = Record<string, string>;

/** Mezőnkénti hibaüzenetek, InternalName szerint. */
export type FieldErrors = Record<string, string>;
