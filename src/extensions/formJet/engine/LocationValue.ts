// Location (hely) mező form-string értéke: JSON objektum a hely nevével, címével és koordinátáival.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

export interface ILocationAddress {
  Street?: string;
  City?: string;
  State?: string;
  CountryOrRegion?: string;
  PostalCode?: string;
}

/** A SharePoint helyobjektuma. Az itt fel nem sorolt tulajdonságokat is megőrizzük és visszaírjuk. */
export interface ILocationData {
  DisplayName?: string;
  LocationUri?: string;
  UniqueId?: string;
  EntityType?: string;
  LocationSource?: string;
  Address?: ILocationAddress;
  Coordinates?: { Latitude?: number; Longitude?: number };
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** A cím egy sorban: utca, irányítószám és település, állam/megye, ország. Üres részek nélkül. */
export function formatLocationAddress(location: ILocationData): string {
  const address: Record<string, unknown> = isRecord(location.Address) ? location.Address : {};
  const city: string = [text(address.PostalCode), text(address.City)].filter((part) => part !== '').join(' ');
  return [text(address.Street), city, text(address.State), text(address.CountryOrRegion)]
    .filter((part) => part !== '')
    .join(', ');
}

/** A hely megjelenítendő neve; név hiányában a cím. */
export function getLocationName(location: ILocationData): string {
  return text(location.DisplayName) || formatLocationAddress(location);
}

/** A form-string értelmezése. Üres vagy nem értelmezhető értékre, illetve név és cím nélküli helyre `undefined`. */
export function parseLocationValue(value: string | undefined): ILocationData | undefined {
  if (!value || value.trim() === '') {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) {
    return undefined;
  }
  const location: ILocationData = parsed as ILocationData;
  return getLocationName(location) === '' ? undefined : location;
}

const MAP_URL: string = 'https://www.bing.com/maps';
const MAP_ZOOM: number = 16;

const EMBED_URL: string = 'https://www.bing.com/maps/embed';

function getCoordinates(location: ILocationData): { latitude: number; longitude: number } | undefined {
  const coordinates: Record<string, unknown> = isRecord(location.Coordinates) ? location.Coordinates : {};
  const latitude: unknown = coordinates.Latitude;
  const longitude: unknown = coordinates.Longitude;
  const valid: boolean =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    isFinite(latitude) &&
    isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  return valid ? { latitude: latitude as number, longitude: longitude as number } : undefined;
}

/**
 * Beágyazható térkép címe (Bing Térképek) a hely koordinátáira középre állítva, a megadott méretben.
 * `undefined`, ha a helynek nincs koordinátája (például egyéni helynél). A cím csak számokból áll össze.
 */
export function getLocationEmbedUrl(location: ILocationData, width: number, height: number): string | undefined {
  const point = getCoordinates(location);
  if (!point) {
    return undefined;
  }
  const center: string = `${point.latitude}~${point.longitude}`;
  return `${EMBED_URL}?h=${height}&w=${width}&cp=${center}&lvl=${MAP_ZOOM}&typ=d&sty=r&src=SHELL&FORM=MBEDV8`;
}

/** A hely térképes megjelenítésének címe (Bing Térképek): koordinátákkal pontosan, ezek nélkül név és cím szerinti kereséssel. */
export function getLocationMapUrl(location: ILocationData): string {
  const name: string = getLocationName(location);
  const point = getCoordinates(location);
  if (point) {
    // A pont nevében az aláhúzás elválasztó, ezért szóközre cseréljük.
    const title: string = encodeURIComponent(name.replace(/_/g, ' '));
    return `${MAP_URL}?sp=point.${point.latitude}_${point.longitude}_${title}&lvl=${MAP_ZOOM}`;
  }
  const address: string = formatLocationAddress(location);
  const query: string = address !== '' && address !== name ? `${name}, ${address}` : name;
  return `${MAP_URL}?q=${encodeURIComponent(query)}`;
}

/** A mentésre kerülő form-string. Hely nélkül üres szöveg, hogy a kötelezőség ellenőrzése működjön. */
export function serializeLocationValue(location: ILocationData | undefined): string {
  return location && getLocationName(location) !== '' ? JSON.stringify(location) : '';
}

/** Kézzel beírt hely, amelyhez nem tartozik keresési találat. */
export function createCustomLocation(name: string): ILocationData {
  return { DisplayName: name.trim(), EntityType: 'Custom', LocationSource: 'None' };
}

/** A hely egysoros szöveges alakja (csak olvasható megjelenítéshez): név, mögötte a cím, ha eltér. */
export function formatLocationValue(value: string | undefined): string {
  const location: ILocationData | undefined = parseLocationValue(value);
  if (!location) {
    return '';
  }
  const name: string = getLocationName(location);
  const address: string = formatLocationAddress(location);
  return address !== '' && address !== name ? `${name} (${address})` : name;
}
