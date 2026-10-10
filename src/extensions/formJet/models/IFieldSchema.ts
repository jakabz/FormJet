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
}

/** Mezőértékek form-string formátumban, InternalName szerint. */
export type FormValues = Record<string, string>;

/** Mezőnkénti hibaüzenetek, InternalName szerint. */
export type FieldErrors = Record<string, string>;
