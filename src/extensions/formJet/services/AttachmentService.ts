// Az elem mellékletei: listázás, feltöltés, törlés (lomtárba).

import '@pnp/sp/attachments';

import { getSP } from './sp';

export interface IAttachmentFile {
  name: string;
  /** Szerverrelatív cím; frissen feltöltött fájlnál üres lehet. */
  url: string;
}

export interface IAttachmentSyncResult {
  deleted: string[];
  uploaded: IAttachmentFile[];
  /** A sikertelen műveletek fájlnevei. */
  failed: string[];
}

export async function isEnabled(listId: string): Promise<boolean> {
  const list = (await getSP().web.lists.getById(listId).select('EnableAttachments')()) as { EnableAttachments?: boolean };
  return !!list.EnableAttachments;
}

export async function list(listId: string, itemId: number): Promise<IAttachmentFile[]> {
  const files = (await getSP().web.lists.getById(listId).items.getById(itemId).attachmentFiles()) as Array<{
    FileName: string;
    ServerRelativeUrl?: string;
  }>;
  return files.map((file) => ({ name: file.FileName, url: file.ServerRelativeUrl ?? '' }));
}

/**
 * A törlések és feltöltések végrehajtása. A SharePoint egy elem mellékleteit nem tudja párhuzamosan
 * módosítani, ezért a műveletek egymás után futnak. Egy hiba nem állítja meg a többit.
 */
export async function sync(listId: string, itemId: number, removed: string[], added: File[]): Promise<IAttachmentSyncResult> {
  const files = getSP().web.lists.getById(listId).items.getById(itemId).attachmentFiles;
  const result: IAttachmentSyncResult = { deleted: [], uploaded: [], failed: [] };

  let chain: Promise<void> = Promise.resolve();
  removed.forEach((name) => {
    chain = chain.then(() =>
      files
        .getByName(name)
        .recycle()
        .then(() => {
          result.deleted.push(name);
        })
        .catch(() => {
          result.failed.push(name);
        })
    );
  });
  added.forEach((file) => {
    chain = chain.then(() =>
      files
        .add(file.name, file)
        .then((info) => {
          const data = info as { ServerRelativeUrl?: string } | undefined;
          result.uploaded.push({ name: file.name, url: data?.ServerRelativeUrl ?? '' });
        })
        .catch(() => {
          result.failed.push(file.name);
        })
    );
  });
  await chain;
  return result;
}
