// A form egészére érvényes adatok, amelyeket a mezővezérlők prop-drilling nélkül érnek el.

import * as React from 'react';

export interface IFormContext {
  /** A web területi beállításainak kultúrája (pl. hu-HU): a dátum form-string formátumát határozza meg. */
  cultureName: string;
  /** A felület nyelve (pl. en-US): a naptár hónap- és napnevei ezen jelennek meg. */
  uiCultureName: string;
}

export const FormContext: React.Context<IFormContext> = React.createContext<IFormContext>({
  cultureName: 'en-US',
  uiCultureName: 'en-US'
});
