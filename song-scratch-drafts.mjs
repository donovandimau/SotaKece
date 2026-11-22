/* Sota Kece — Song Scratch drafts, kept on this phone only (IndexedDB; photos and clips as files).
   Every call fails softly: private windows and old browsers simply have no drafts. */
const DB = 'sota-song-scratch', STORE = 'drafts', VERSION = 1;
export const AUTO = 'auto';      // the draft kept automatically while you work
export const MAX_DRAFTS = 20;

function open() {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(DB, VERSION); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode), st = tx.objectStore(STORE);
      const req = fn(st);
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function saveDraft(draft) {
  await run('readwrite', (st) => st.put(draft));
  if (draft.id !== AUTO) {
    // keep the newest MAX_DRAFTS named drafts
    const all = (await listDrafts()).filter((d) => d.id !== AUTO);
    for (const old of all.slice(MAX_DRAFTS)) await deleteDraft(old.id);
  }
}
export const getDraft = (id) => run('readonly', (st) => st.get(id));
export const deleteDraft = (id) => run('readwrite', (st) => st.delete(id));

/** All drafts, newest first, without their files (for the list). */
export async function listDrafts() {
  const all = (await run('readonly', (st) => st.getAll())) || [];
  return all.map(({ id, name, savedAt, thumb }) => ({ id, name, savedAt, thumb })).sort((a, b) => b.savedAt - a.savedAt);
}

export function draftLabel(d, now = Date.now()) {
  const mins = Math.round((now - d.savedAt) / 60000);
  const when = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : new Date(d.savedAt).toLocaleDateString();
  return `${d.name || 'Story'} · ${when}`;
}
