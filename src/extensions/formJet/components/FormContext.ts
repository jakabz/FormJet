// A form egészére érvényes adatok, amelyeket a mezővezérlők prop-drilling nélkül érnek el.

import * as React from 'react';

import { FormValues } from '../models/IFieldSchema';

export interface IFormContext {
  /** A web területi beállításainak kultúrája (pl. hu-HU): a dátum form-string formátumát határozza meg. */
  cultureName: string;
  /** A felület nyelve (pl. en-US): a naptár hónap- és napnevei ezen jelennek meg. */
  uiCultureName: string;
  /** A megnyitott elem azonosítója; új elemnél nincs. */
  itemId?: number;
  /** Az elem betöltéskori (mentett) form-string értékei: a kapcsolódó elemek párosításának alapja. */
  sourceValues: FormValues;
}

export const FormContext: React.Context<IFormContext> = React.createContext<IFormContext>({
  cultureName: 'en-US',
  uiCultureName: 'en-US',
  sourceValues: {}
});
