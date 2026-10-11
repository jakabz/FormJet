// A mezőtípusok form-string értékeinek értelmezése és előállítása.

import { validateAttachmentName } from '../Attachments';
import { isEmptyValue } from '../ConditionEngine';
import { createImageValue, createPendingImageValue, getImageUrl, IImageData, parseImageValue } from '../ImageValue';
import {
  createCustomLocation,
  formatLocationAddress,
  formatLocationValue,
  getLocationEmbedUrl,
  getLocationMapUrl,
  getLocationName,
  ILocationData,
  parseLocationValue,
  serializeLocationValue
} from '../LocationValue';
import { normalizeLookupListId, parseLookupValue, serializeLookupValue } from '../LookupValue';
import { formatTaxonomyValue, normalizeTermGuid, parseTaxonomyValue, serializeTaxonomyValue } from '../TaxonomyValue';
import { isSafeUrl, parseUrlValue, serializeUrlValue } from '../UrlValue';
import { formatUserValue, parseUserValue, serializeUserValue } from '../UserValue';

// Szkriptet futtató cím a biztonsági tesztekhez (összefűzve, hogy a lint ne valódi hivatkozásnak lássa).
const SCRIPT_URL: string = ['javascript', 'alert(1)'].join(':');

describe('LookupValue', () => {
  it('a listaazonosító normalizálása; nem listára mutató értékre nincs azonosító', () => {
    expect(normalizeLookupListId('{11111111-2222-3333-4444-55555555AAAA}')).toBe('11111111-2222-3333-4444-55555555aaaa');
    expect(normalizeLookupListId('UserInfo')).toBeUndefined();
    expect(normalizeLookupListId('')).toBeUndefined();
    expect(normalizeLookupListId(undefined)).toBeUndefined();
  });

  it('értelmezés: többféle SharePoint-alakot elfogad', () => {
    expect(parseLookupValue('5')).toEqual([5]);
    expect(parseLookupValue('5;#Cím')).toEqual([5]);
    expect(parseLookupValue('5;#Cím A;#6;#Cím B')).toEqual([5, 6]);
    expect(parseLookupValue('5;#;#6;#')).toEqual([5, 6]);
    expect(parseLookupValue('5;#12 alma;#6;#7')).toEqual([5, 6]);
    expect(parseLookupValue('5;#;#5;#')).toEqual([5]);
  });

  it('üres és hibás értékre üres lista', () => {
    ['', undefined, '  ', 'abc', '0', '-3', '[]'].forEach((value) => expect(parseLookupValue(value)).toEqual([]));
  });

  it('előállítás és oda-vissza alakítás', () => {
    expect(serializeLookupValue([5], false)).toBe('5');
    expect(serializeLookupValue([5, 6], true)).toBe('5;#;#6;#');
    expect(serializeLookupValue([7], true)).toBe('7;#');
    expect(serializeLookupValue([], true)).toBe('');
    expect(serializeLookupValue([], false)).toBe('');
    expect(parseLookupValue(serializeLookupValue([5, 6, 12], true))).toEqual([5, 6, 12]);
  });
});

describe('UserValue', () => {
  const stored: string = JSON.stringify([
    { Key: 'i:0#.f|membership|anna@contoso.com', DisplayText: 'Kiss Anna', EntityData: { Email: 'anna@contoso.com', Title: 'Kiss Anna' } },
    { Key: 'Csapat tagjai', DisplayText: 'Csapat tagjai', EntityType: 'SPGroup', EntityData: {} }
  ]);

  it('értelmezés: kulcs, név és e-mail', () => {
    const entries = parseUserValue(stored);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ key: 'i:0#.f|membership|anna@contoso.com', text: 'Kiss Anna', secondaryText: 'anna@contoso.com' });
    expect(entries[1].key).toBe('Csapat tagjai');
  });

  it('üres és hibás értékre üres lista; ismétlődő kulcs egyszer', () => {
    [undefined, '', '  ', '[]', 'nem json', '{}', '[1,null,{}]', JSON.stringify([{ DisplayText: 'x' }])].forEach((value) =>
      expect(parseUserValue(value)).toEqual([])
    );
    expect(parseUserValue(JSON.stringify([{ Key: 'a' }, { Key: 'a' }]))).toHaveLength(1);
    expect(parseUserValue(JSON.stringify([{ Key: 'a' }]))[0].text).toBe('a');
  });

  it('előállítás, megjelenítés és kötelezőség', () => {
    const value = serializeUserValue(parseUserValue(stored));
    expect(value).toBe(
      JSON.stringify([
        { Key: 'i:0#.f|membership|anna@contoso.com', DisplayText: 'Kiss Anna' },
        { Key: 'Csapat tagjai', DisplayText: 'Csapat tagjai' }
      ])
    );
    expect(serializeUserValue([])).toBe('');
    expect(formatUserValue(value)).toBe('Kiss Anna; Csapat tagjai');
    expect(formatUserValue('')).toBe('');
    expect(isEmptyValue(serializeUserValue([]))).toBe(true);
    expect(isEmptyValue(value)).toBe(false);
  });
});

describe('UrlValue', () => {
  it('értelmezés: cím és leírás; a címmel egyező leírás üres', () => {
    expect(parseUrlValue('https://contoso.com, Weboldal')).toEqual({ url: 'https://contoso.com', description: 'Weboldal' });
    expect(parseUrlValue('https://a.hu')).toEqual({ url: 'https://a.hu', description: '' });
    expect(parseUrlValue('https://a.hu, https://a.hu')).toEqual({ url: 'https://a.hu', description: '' });
    expect(parseUrlValue('https://a.hu, Egy, két, három')).toEqual({ url: 'https://a.hu', description: 'Egy, két, három' });
    expect(parseUrlValue('')).toEqual({ url: '', description: '' });
    expect(parseUrlValue(undefined)).toEqual({ url: '', description: '' });
  });

  it('a címben szereplő vessző duplázva áll', () => {
    expect(parseUrlValue('https://a.hu/x?a=1,,2, Cím')).toEqual({ url: 'https://a.hu/x?a=1,2', description: 'Cím' });
    expect(serializeUrlValue({ url: 'https://a.hu/x?a=1,2', description: 'Cím' })).toBe('https://a.hu/x?a=1,,2, Cím');
    expect(parseUrlValue(serializeUrlValue({ url: 'https://a.hu/x?a=1,2', description: 'Egy, két' }))).toEqual({
      url: 'https://a.hu/x?a=1,2',
      description: 'Egy, két'
    });
  });

  it('előállítás: leírás nélkül a cím ismétlődik, cím nélkül üres', () => {
    expect(serializeUrlValue({ url: 'https://a.hu', description: 'Cím' })).toBe('https://a.hu, Cím');
    expect(serializeUrlValue({ url: ' https://a.hu ', description: '' })).toBe('https://a.hu, https://a.hu');
    expect(serializeUrlValue({ url: '', description: 'Cím' })).toBe('');
    expect(serializeUrlValue({ url: '  ', description: '' })).toBe('');
  });

  it('isSafeUrl: csak webcím, e-mail és webhelyen belüli útvonal', () => {
    ['https://a.hu', 'HTTP://a.hu', 'mailto:a@b.hu', '/sites/x', ' https://a.hu'].forEach((url) => expect(isSafeUrl(url)).toBe(true));
    [SCRIPT_URL, SCRIPT_URL.toUpperCase(), 'data:text/html,x', '//gonosz.hu', 'vbscript:x', 'a.hu', 'file:///c:/x'].forEach((url) =>
      expect(isSafeUrl(url)).toBe(false)
    );
  });
});

describe('LocationValue', () => {
  const place: ILocationData = {
    DisplayName: 'Parlament',
    LocationUri: 'https://www.bingapis.com/api/v6/localbusinesses/X',
    EntityType: 'LocalBusiness',
    LocationSource: 'Bing',
    Address: { Street: 'Kossuth Lajos tér 1-3', City: 'Budapest', State: '', CountryOrRegion: 'Magyarország', PostalCode: '1055' },
    Coordinates: { Latitude: 47.507, Longitude: 19.045 },
    Egyeb: { x: 1 }
  };
  const stored: string = JSON.stringify(place);

  it('oda-vissza változatlan, az ismeretlen tulajdonságokkal együtt', () => {
    expect(serializeLocationValue(parseLocationValue(stored))).toBe(stored);
  });

  it('cím és megjelenítés', () => {
    expect(formatLocationAddress(place)).toBe('Kossuth Lajos tér 1-3, 1055 Budapest, Magyarország');
    expect(formatLocationValue(stored)).toBe('Parlament (Kossuth Lajos tér 1-3, 1055 Budapest, Magyarország)');
    expect(getLocationName({ Address: { City: 'Győr' } })).toBe('Győr');
    expect(formatLocationValue(JSON.stringify({ Address: { City: 'Győr' } }))).toBe('Győr');
  });

  it('üres, hibás és név nélküli érték elutasítva', () => {
    [undefined, '', '  ', 'nem json', '[]', '{}', 'null', JSON.stringify({ DisplayName: '  ' }), JSON.stringify({ Coordinates: { Latitude: 1 } })].forEach(
      (value) => {
        expect(parseLocationValue(value)).toBeUndefined();
        expect(formatLocationValue(value)).toBe('');
      }
    );
  });

  it('egyéni hely: csak név', () => {
    const custom = createCustomLocation('  Nagy tárgyaló ');
    expect(serializeLocationValue(custom)).toBe(JSON.stringify({ DisplayName: 'Nagy tárgyaló', EntityType: 'Custom', LocationSource: 'None' }));
    expect(serializeLocationValue(createCustomLocation(' '))).toBe('');
    expect(serializeLocationValue(undefined)).toBe('');
  });

  it('térképcímek: koordinátákkal pontosan, ezek nélkül kereséssel', () => {
    expect(getLocationEmbedUrl(place, 600, 500)).toBe(
      'https://www.bing.com/maps/embed?h=500&w=600&cp=47.507~19.045&lvl=16&typ=d&sty=r&src=SHELL&FORM=MBEDV8'
    );
    expect(getLocationMapUrl(place)).toBe('https://www.bing.com/maps?sp=point.47.507_19.045_Parlament&lvl=16');
    expect(getLocationMapUrl(createCustomLocation('Nagy tárgyaló'))).toBe('https://www.bing.com/maps?q=Nagy%20t%C3%A1rgyal%C3%B3');
    expect(getLocationMapUrl({ DisplayName: 'A_B & C', Coordinates: { Latitude: 1, Longitude: 2 } })).toContain('A%20B%20%26%20C');
  });

  it('beágyazott térkép csak érvényes koordinátákkal készül', () => {
    const invalid: ILocationData[] = [
      createCustomLocation('x'),
      { DisplayName: 'x', Coordinates: { Latitude: 120, Longitude: 19 } },
      { DisplayName: 'x', Coordinates: { Latitude: NaN, Longitude: 19 } },
      { DisplayName: 'x', Coordinates: { Latitude: '47', Longitude: 19 } as unknown as ILocationData['Coordinates'] }
    ];
    invalid.forEach((location) => expect(getLocationEmbedUrl(location, 600, 500)).toBeUndefined());
  });
});

describe('ImageValue', () => {
  const stored: string = createImageValue({
    fileName: 'logó 1.png',
    serverRelativeUrl: '/sites/x/SiteAssets/Lists/abc/logó 1.png',
    id: 'g-1',
    serverUrl: 'https://t.sharepoint.com',
    fieldName: 'Kep',
    fieldId: 'f-1'
  });

  it('a feltöltött kép form-stringje', () => {
    expect(JSON.parse(stored)).toEqual({
      type: 'thumbnail',
      fileName: 'logó 1.png',
      nativeFile: {},
      fieldName: 'Kep',
      serverUrl: 'https://t.sharepoint.com',
      fieldId: 'f-1',
      serverRelativeUrl: '/sites/x/SiteAssets/Lists/abc/logó 1.png',
      id: 'g-1'
    });
  });

  it('megjeleníthető cím: kódolva, a már kódolt útvonalat nem kódolja kétszer', () => {
    expect(getImageUrl(parseImageValue(stored) as IImageData, undefined, undefined)).toBe('/sites/x/SiteAssets/Lists/abc/log%C3%B3%201.png');
    expect(getImageUrl({ serverRelativeUrl: '/sites/x/a%20b.png' }, undefined, undefined)).toBe('/sites/x/a%20b.png');
  });

  it('az elem mellékleteként tárolt kép címe a listából és az elem azonosítójából áll össze', () => {
    const image: IImageData = { fileName: 'Reserved_ImageAttachment_[5]_[Kep][3]_[a b][1].png' };
    expect(getImageUrl(image, '/sites/x/Lists/Teszt', 7)).toBe(
      '/sites/x/Lists/Teszt/Attachments/7/Reserved_ImageAttachment_%5B5%5D_%5BKep%5D%5B3%5D_%5Ba%20b%5D%5B1%5D.png'
    );
    expect(getImageUrl(image, '/sites/x/Lists/Teszt', undefined)).toBeUndefined();
  });

  it('nem webhelyen belüli címből nem készül képcím', () => {
    [
      { serverRelativeUrl: 'https://gonosz.hu/a.png' },
      { serverRelativeUrl: '//gonosz.hu/a.png' },
      { serverRelativeUrl: SCRIPT_URL },
      { serverRelativeUrl: '/\\gonosz.hu/a.png' },
      { fileName: 'sima.png' }
    ].forEach((image) => expect(getImageUrl(image, '/sites/x/Lists/T', 1)).toBeUndefined());
  });

  it('üres és hibás érték elutasítva', () => {
    [undefined, '', '  ', 'nem json', '[]', '{}', 'null', JSON.stringify({ type: 'thumbnail' }), JSON.stringify({ fileName: ' ' })].forEach((value) =>
      expect(parseImageValue(value)).toBeUndefined()
    );
  });

  it('függőben lévő kép: nem üres, eltér a mentett értéktől, és nincs megjeleníthető címe', () => {
    const pending = createPendingImageValue('uj.png');
    expect(parseImageValue(pending)).toEqual({ pending: true, fileName: 'uj.png' });
    expect(isEmptyValue(pending)).toBe(false);
    expect(pending).not.toBe(stored);
    expect(getImageUrl(parseImageValue(pending) as IImageData, '/l', 1)).toBeUndefined();
  });
});

describe('TaxonomyValue', () => {
  const a: string = '3f2a1b4c-0000-4000-8000-0000000000a1';
  const b: string = '7C1B1B4C-0000-4000-8000-0000000000B2';

  it('értelmezés: egy és több érték, nagybetűs azonosítóval is', () => {
    expect(parseTaxonomyValue(`Budapest|${a}`)).toEqual([{ id: a, label: 'Budapest' }]);
    expect(parseTaxonomyValue(`Budapest|${a};Győr|${b};`)).toEqual([
      { id: a, label: 'Budapest' },
      { id: b.toLowerCase(), label: 'Győr' }
    ]);
  });

  it('értelmezés: belső sorszámos alakok', () => {
    expect(parseTaxonomyValue(`5;#Budapest|${a}`)).toEqual([{ id: a, label: 'Budapest' }]);
    expect(parseTaxonomyValue(`-1;#Budapest|${a}`)).toEqual([{ id: a, label: 'Budapest' }]);
    expect(parseTaxonomyValue(`1;#Budapest|${a};#2;#Győr|${b}`)).toHaveLength(2);
  });

  it('ismétlődés, üres azonosító és hibás érték kiszűrve', () => {
    expect(parseTaxonomyValue(`A|${a};A|${a};`)).toHaveLength(1);
    expect(parseTaxonomyValue('X|00000000-0000-0000-0000-000000000000')).toEqual([]);
    [undefined, '', '  ', 'Budapest', 'Budapest|nem-guid', '[]'].forEach((value) => expect(parseTaxonomyValue(value)).toEqual([]));
  });

  it('előállítás: a címkéből kimaradnak az elválasztó karakterek; egyértékűnél csak az első', () => {
    const terms = [
      { id: a, label: 'Budapest' },
      { id: b.toLowerCase(), label: 'Győr; Pápa|x' }
    ];
    expect(serializeTaxonomyValue(terms, true)).toBe(`Budapest|${a};Győr  Pápa x|${b.toLowerCase()};`);
    expect(serializeTaxonomyValue(terms, false)).toBe(`Budapest|${a};`);
    expect(serializeTaxonomyValue([], true)).toBe('');
    expect(parseTaxonomyValue(serializeTaxonomyValue(terms, true))).toHaveLength(2);
  });

  it('megjelenítés és az azonosító normalizálása', () => {
    expect(formatTaxonomyValue(`Budapest|${a};Győr|${b};`)).toBe('Budapest; Győr');
    expect(normalizeTermGuid(`{${b}}`)).toBe(b.toLowerCase());
    expect(normalizeTermGuid('00000000-0000-0000-0000-000000000000')).toBeUndefined();
    expect(normalizeTermGuid('')).toBeUndefined();
    expect(normalizeTermGuid(undefined)).toBeUndefined();
  });
});

describe('Attachments', () => {
  it('érvényes fájlnevek', () => {
    expect(validateAttachmentName('ajánlat 2026.pdf', [])).toBeUndefined();
    expect(validateAttachmentName('a.b.c.docx', ['x.pdf'])).toBeUndefined();
    expect(validateAttachmentName('Kép (1).png', [])).toBeUndefined();
  });

  it('nem megengedett karaktert tartalmazó, üres vagy túl hosszú név', () => {
    ['', '  ', 'a:b.txt', 'a/b.txt', 'a\\b.txt', 'a?.txt', 'a*.txt', 'a|b', 'a<b>', 'a"b', '.rejtett', 'vége.', 'a#b.txt', 'a%b.txt', 'x'.repeat(251)].forEach(
      (name) => expect(validateAttachmentName(name, [])).toBe('invalid')
    );
  });

  it('már meglévő név, kis- és nagybetűtől függetlenül', () => {
    expect(validateAttachmentName('Ajanlat.PDF', ['ajanlat.pdf'])).toBe('duplicate');
    expect(validateAttachmentName('uj.pdf', ['ajanlat.pdf'])).toBeUndefined();
  });
});
