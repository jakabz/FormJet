// A felügyelt metaadat mező választható kifejezései a kifejezéstárból (SharePoint v2.1 termStore végpont).

import { ITermOption } from '../engine/TaxonomyValue';
import { getWebUrl } from './sp';

/** Ennyi kifejezést töltünk be legfeljebb egy készletből. */
export const TERM_LIMIT: number = 2000;
const PATH_SEPARATOR: string = ' > ';

export interface ITermOptions {
  terms: ITermOption[];
  /** A készletben több kifejezés van, mint amennyit betöltöttünk. */
  hasMore: boolean;
}

interface IRawLabel {
  name?: string;
  isDefault?: boolean;
  languageTag?: string;
}

interface IRawTerm {
  id: string;
  labels?: IRawLabel[];
  childrenCount?: number;
  isDeprecated?: boolean;
}

const cache: Record<string, Promise<ITermOptions> | undefined> = {};

async function getChildren(path: string): Promise<IRawTerm[]> {
  const url: string = `${getWebUrl()}/_api/v2.1/termStore/${path}/children?$select=id,labels,childrenCount,isDeprecated&$top=1000`;
  const response: Response = await fetch(url, {
    headers: { accept: 'application/json;odata.metadata=none' },
    credentials: 'same-origin'
  });
  if (!response.ok) {
    throw new Error(`Term store request failed: ${response.status}`);
  }
  const data = (await response.json()) as { value?: IRawTerm[] };
  return data.value ?? [];
}

/** A kifejezés címkéje a felület nyelvén; ennek hiányában az alapértelmezett címke. */
function pickLabel(labels: IRawLabel[] | undefined, language: string): string {
  const list: IRawLabel[] = labels ?? [];
  const prefix: string = language.split('-')[0].toLowerCase();
  const localized: IRawLabel[] = list.filter(
    (label) => !!label.isDefault && (label.languageTag ?? '').toLowerCase().split('-')[0] === prefix
  );
  const fallback: IRawLabel[] = list.filter((label) => !!label.isDefault);
  return (localized[0] ?? fallback[0] ?? list[0])?.name ?? '';
}

async function load(termSetId: string, anchorId: string | undefined, language: string): Promise<ITermOptions> {
  const setPath: string = `sets/${termSetId}`;
  const result: ITermOptions = { terms: [], hasMore: false };

  // Mélységi bejárás, a testvérek sorrendjét megtartva.
  const visit = async (path: string, parentPath: string): Promise<void> => {
    if (result.terms.length >= TERM_LIMIT) {
      result.hasMore = true;
      return;
    }
    const children: IRawTerm[] = (await getChildren(path)).filter((term) => !term.isDeprecated);
    const branches: Array<{ term: IRawTerm; label: string; path: string }> = children.map((term) => {
      const label: string = pickLabel(term.labels, language);
      return { term, label, path: parentPath ? `${parentPath}${PATH_SEPARATOR}${label}` : label };
    });
    let chain: Promise<void> = Promise.resolve();
    branches.forEach((branch) => {
      chain = chain.then(() => {
        if (result.terms.length >= TERM_LIMIT) {
          result.hasMore = true;
          return undefined;
        }
        result.terms.push({ id: branch.term.id.toLowerCase(), label: branch.label, path: branch.path });
        return (branch.term.childrenCount ?? 0) > 0
          ? visit(`${setPath}/terms/${branch.term.id}`, branch.path)
          : undefined;
      });
    });
    await chain;
  };

  await visit(anchorId ? `${setPath}/terms/${anchorId}` : setPath, '');
  return result;
}

/** A készlet (vagy a horgony alatti rész) választható kifejezései. Az eredményt a munkamenet idejére megjegyezzük. */
export function getTerms(termSetId: string, anchorId: string | undefined, language: string): Promise<ITermOptions> {
  const key: string = `${termSetId}|${anchorId ?? ''}|${language}`;
  const cached: Promise<ITermOptions> | undefined = cache[key];
  if (cached) {
    return cached;
  }
  const request: Promise<ITermOptions> = load(termSetId, anchorId, language);
  cache[key] = request;
  // Hibás kérést nem jegyzünk meg, hogy újra lehessen próbálni.
  request.catch(() => {
    delete cache[key];
  });
  return request;
}
