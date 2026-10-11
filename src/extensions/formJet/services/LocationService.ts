// Helyek keresése a Microsoft 365 helykeresőjével (Bing), ugyanazzal, amit a gyári hely mező használ.
// Ez nem SharePoint REST hívás: az Outlook szolgáltatás végpontját hívjuk a felhasználó tokenjével.

import { ILocationData } from '../engine/LocationValue';
import { getAadToken } from './sp';

const TOKEN_RESOURCE: string = 'https://outlook.office365.com';
const SEARCH_URL: string = 'https://outlook.office365.com/SchedulingB2/api/v1.0/me/findmeetinglocations';
/** A keresési szolgáltató azonosítója: Bing. */
const LOCATION_PROVIDER_BING: number = 32;

interface ISearchResponse {
  MeetingLocations?: Array<{ MeetingLocation?: ILocationData }>;
}

/** Helyek keresése név vagy cím alapján. Hibát dob, ha a kereső nem érhető el. */
export async function searchLocations(query: string, market: string): Promise<ILocationData[]> {
  const text: string = query.trim();
  if (text === '') {
    return [];
  }
  const token: string = await getAadToken(TOKEN_RESOURCE);
  const response: Response = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      QueryConstraint: { Query: text },
      LocationProvider: LOCATION_PROVIDER_BING,
      BingMarket: market
    })
  });
  if (!response.ok) {
    throw new Error(`Location search failed: ${response.status}`);
  }
  const data = (await response.json()) as ISearchResponse;
  return (data.MeetingLocations ?? [])
    .map((item) => item.MeetingLocation)
    .filter((location): location is ILocationData => !!location && !!location.DisplayName);
}
