/* Sota Kece — keeps the member's chosen motion wallpaper on their device and
   plays it inside any element: SotaMotionStore.mountSaved(document.querySelector('#sota-kece-profile-backdrop')). */
(function () {
  'use strict';
  const DB = 'sota-motion', STORE = 'wallpaper', KEY = 'profile';
  function open() {
    return new Promise(function (resolve, reject) {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }
  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        const t = db.transaction(STORE, mode), req = fn(t.objectStore(STORE));
        t.oncomplete = function () { resolve(req && req.result); db.close(); };
        t.onerror = function () { reject(t.error); db.close(); };
      });
    });
  }
  const api = {
    save: function (rec) { return tx('readwrite', function (s) { return s.put(rec, KEY); }); },
    load: function () { return tx('readonly', function (s) { return s.get(KEY); }); },
    clear: function () { return tx('readwrite', function (s) { return s.delete(KEY); }); },
    mountSaved: async function (el) {
      if (!el || !window.SotaMotionEngine) return null;
      const rec = await api.load().catch(function () { return null; });
      if (!rec || !rec.blob) return null;
      const bmp = await createImageBitmap(rec.blob);
      return window.SotaMotionEngine.mount(el, bmp, rec.settings);
    }
  };
  window.SotaMotionStore = api;
})();
