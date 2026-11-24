/* Keeps a member's page design (colours, font, density…) on their account so it follows them to another
   phone. The design itself is still read and written by space-design.js in this browser; this file only
   copies it to and from bulavata.member_prefs (bv_prefs_get / bv_prefs_save) when the member is signed in.
   Wallpaper pictures live in this browser's storage and are not copied. If the database has no
   member_prefs yet, every call fails quietly and the design stays on the device as before. */
(function (root, factory) { var api = factory(root); if (typeof module === 'object' && module.exports) module.exports = api; else root.SotaDesignSync = api; })(typeof globalThis === 'object' ? globalThis : this, function (root) {
  var PREFIX = 'sota-page-design:v1:account:', client = null, uid = null, timer = null, started = false, pushing = false;
  function store() { try { return root.localStorage; } catch (_) { return null; } }
  function key(id) { return PREFIX + encodeURIComponent(String(id).slice(0, 180)); }
  function syncedKey(id) { return 'sota-page-design-synced:' + encodeURIComponent(String(id).slice(0, 180)); }
  /** What goes to the account: pages and their settings, minus the wallpaper picture (it is device-only). */
  function strip(raw) {
    var rec; try { rec = JSON.parse(raw || 'null'); } catch (_) { return null; }
    if (!rec || rec.version !== 1 || !rec.pages || typeof rec.pages !== 'object') return null;
    var out = { version: 1, pages: {} };
    Object.keys(rec.pages).forEach(function (p) {
      var v = rec.pages[p]; if (!v || typeof v !== 'object') return;
      var c = {}; Object.keys(v).forEach(function (k) { if (k !== 'imageId') c[k] = v[k]; }); out.pages[p] = c;
    });
    return Object.keys(out.pages).length ? out : null;
  }
  function valid(rec) { return !!(rec && rec.version === 1 && rec.pages && typeof rec.pages === 'object' && Object.keys(rec.pages).length); }
  async function sync() {
    var st = store(); if (!client || !uid || !st) return;
    var id = uid, local = strip(st.getItem(key(id))), localJson = local ? JSON.stringify(local) : '', last = st.getItem(syncedKey(id));
    var res = await client.rpc('bv_prefs_get'); if (res.error) return;
    var server = res.data && res.data.page_design, serverJson = valid(server) ? JSON.stringify(server) : '';
    if (id !== uid) return;
    // First time this device meets this account's saved design: the account wins, so a stale local copy cannot
    // overwrite it. The local copy is kept aside rather than thrown away.
    if (serverJson && localJson && last === null && localJson !== serverJson) { try { st.setItem('sota-page-design-backup:' + encodeURIComponent(String(id).slice(0, 180)), localJson); } catch (_) {} local = null; localJson = ''; }
    if (localJson && localJson !== last && localJson !== serverJson) { await push(); return; }      // changed here: send it
    if (serverJson && serverJson !== localJson) {                                                    // changed elsewhere: take it
      var cur; try { cur = JSON.parse(st.getItem(key(id)) || 'null'); } catch (_) { cur = null; }
      var merged = { version: 1, pages: {} };
      Object.keys(server.pages).forEach(function (p) { var v = Object.assign({}, server.pages[p]); if (cur && cur.pages && cur.pages[p] && cur.pages[p].imageId) v.imageId = cur.pages[p].imageId; merged.pages[p] = v; });
      st.setItem(key(id), JSON.stringify(merged)); st.setItem(syncedKey(id), serverJson);
      root.SotaSpaceDesign && root.SotaSpaceDesign.reload && root.SotaSpaceDesign.reload();
    } else if (serverJson) st.setItem(syncedKey(id), serverJson);
  }
  async function push() {
    var st = store(); if (!client || !uid || !st || pushing) return;
    var id = uid, local = strip(st.getItem(key(id))); if (!local) return;
    pushing = true;
    try { var r = await client.rpc('bv_prefs_save', { p_page_design: local }); if (!r.error && id === uid) st.setItem(syncedKey(id), JSON.stringify(local)); }
    catch (_) {} finally { pushing = false; }
  }
  function schedule() { if (!uid) return; clearTimeout(timer); timer = setTimeout(push, 1500); }
  function watchWrites() {
    var proto = root.Storage && root.Storage.prototype; if (!proto || proto.__sotaDesignSync) return;
    var orig = proto.setItem;
    proto.setItem = function (k, v) { var r = orig.apply(this, arguments); try { if (uid && k === key(uid)) schedule(); } catch (_) {} return r; };
    proto.__sotaDesignSync = true;
  }
  function init(cfg) {
    if (started || !cfg || !cfg.client) return; started = true; client = cfg.client; watchWrites();
    client.auth.onAuthStateChange(function (_e, session) {
      var next = session && session.user && session.user.id || null;
      if (next === uid) return; uid = next; clearTimeout(timer);
      if (uid) setTimeout(function () { sync().catch(function () {}); }, 0);
    });
  }
  return { init: init, sync: sync, push: push, strip: strip, key: key };
});
