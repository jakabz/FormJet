// A kép mező fájljának feltöltése. A SharePoint a képet a webhely eszköztárába (Site Assets) menti,
// a lista saját mappájába; a mező értéke a feltöltött fájlra hivatkozik.

import { spPost } from '@pnp/sp';
import { Web } from '@pnp/sp/webs';

import { createImageValue } from '../engine/ImageValue';
import { getSP, getWebOrigin } from './sp';

interface IUploadResult {
  Name?: string;
  ServerRelativeUrl?: string;
  UniqueId?: string;
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** A kép feltöltése; az eredmény a mezőbe írható form-string. Hibát dob, ha a feltöltés nem sikerült. */
export async function uploadImage(
  listId: string,
  itemId: number | undefined,
  field: { name: string; id: string },
  file: File
): Promise<string> {
  const sp = getSP();
  const list = (await sp.web.lists.getById(listId).select('Title')()) as { Title: string };

  const request = Web(sp.web, 'UploadImage(listTitle=@a1,imageName=@a2,listId=@a3,itemId=@a4)');
  request.query.set('@a1', quote(list.Title));
  request.query.set('@a2', quote(file.name));
  request.query.set('@a3', quote(listId));
  request.query.set('@a4', String(itemId ?? 0));
  const result: IUploadResult = await spPost<IUploadResult>(request, {
    body: file,
    headers: { 'content-type': 'application/octet-stream' }
  });
  if (!result || !result.ServerRelativeUrl) {
    throw new Error('The image upload returned no file.');
  }
  return createImageValue({
    fileName: result.Name || file.name,
    serverRelativeUrl: result.ServerRelativeUrl,
    id: result.UniqueId ?? '',
    serverUrl: getWebOrigin(),
    fieldName: field.name,
    fieldId: field.id
  });
}
