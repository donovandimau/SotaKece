/* Sota Kece — Song Scratch: post the story to Sota Stories (24 hours, friends or close friends).
   Three ways to post:
     scratch : friends scratch it themselves to hear the song (three still layers + the song)
     video   : the saved story video with the music
     picture : one still picture
   Files go to the private "sota-stories" bucket under the member's own folder; the database decides
   who may read them (bulavata.can_see_story_file). Uses the same sign-in as the rest of Sota Kece. */
const SB_URL = 'https://xnxmumbvgtmlpenutlii.supabase.co';
const SB_KEY = 'sb_publishable_WFJ3jKwImNhGdTdrS9W6mg_3CUSUYIM';
const BUCKET = 'sota-stories';

export const KINDS = { scratch: 'Scratch story', video: 'Video', picture: 'Picture' };
export const AUDIENCES = { friends: 'Friends', close: 'Close friends' };

export function extFor(type) {
  return { 'video/mp4': 'mp4', 'video/webm': 'webm', 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg' }[String(type).split(';')[0]] || null;
}

/** Plain words for what went wrong. */
export function postError(e) {
  const m = String(e?.message || e || '');
  if (/NOT_SIGNED_IN|JWT|not authenticated/i.test(m)) return 'Please sign in on Sota Kece first, then come back.';
  if (/STORY_LIMIT/.test(m)) return 'That is 30 stories today. Try again tomorrow.';
  if (/TOO_LONG/.test(m)) return 'The words are too long. Keep it under 300 letters.';
  if (/SONG_BAD/.test(m)) return 'Choose a song first: a scratch story needs one.';
  if (/Bucket not found|bv_story_post_media|PGRST202|Could not find the function/i.test(m)) return 'Posting pictures and videos to Stories is not switched on yet.';
  if (/payload too large|exceeded the maximum|413/i.test(m)) return 'The video is too big to post. Make it shorter and try again.';
  if (/mime type|not supported/i.test(m)) return 'This browser made a file type Stories cannot take. Try Picture instead.';
  return 'The story could not be posted. Check your connection and try again.';
}

let client = null;
function sb() {
  if (!client && window.supabase?.createClient) client = window.supabase.createClient(SB_URL, SB_KEY);
  return client;
}
async function member() {
  const c = sb(); if (!c) return null;
  try { const { data } = await c.auth.getSession(); return data?.session?.user || null; } catch (_) { return null; }
}
function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
}

async function upload(path, blob) {
  const { error } = await sb().storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '3600' });
  if (error) throw error;
}

/** Remove the files of stories that have run out (the database hands back their stems). */
async function tidy(uid) {
  try {
    const { data: stems } = await sb().rpc('bv_story_tidy');
    for (const stem of stems || []) {
      const id = String(stem).split('/')[1];
      const { data: files } = await sb().storage.from(BUCKET).list(uid, { search: id, limit: 10 });
      const names = (files || []).filter((f) => f.name.startsWith(id)).map((f) => `${uid}/${f.name}`);
      if (names.length) await sb().storage.from(BUCKET).remove(names);
    }
  } catch (_) { /* tidying is a nicety; never block posting */ }
}

export async function postStory({ kind, audience, caption }, story, progress = () => {}) {
  const user = await member();
  if (!user) throw new Error('NOT_SIGNED_IN');
  const S = story.state();
  if (kind === 'scratch' && !S.song) throw new Error('SONG_BAD');
  const stem = `${user.id}/${newId()}`, uploaded = [];
  const put = async (suffix, blob) => {
    const ext = extFor(blob?.type);
    if (!blob || !ext) throw new Error('mime type not supported');
    const path = `${stem}${suffix}.${ext}`;
    await upload(path, blob); uploaded.push(path);
  };
  try {
    if (kind === 'video') {
      progress('Making the video…');
      const v = await story.recordStory();
      if (!v) throw new Error('VIDEO_FAILED');
      progress('Sending it to Sota…');
      await put('', v.blob);
    } else if (kind === 'picture') {
      await put('', await story.stillPicture());
    } else {
      progress('Getting the layers ready…');
      const l = await story.scratchLayers();
      progress('Sending it to Sota…');
      await put('-under', l.under); await put('-cover', l.cover); await put('-over', l.over);
    }
    const song = S.song ? { p_song_id: S.song.id, p_song_start: Math.round(S.start || 0) } : { p_song_id: null, p_song_start: null };
    const { data, error } = await sb().rpc('bv_story_post_media', {
      p_stem: stem, p_kind: kind, p_body: (caption || '').trim() || null, p_audience: audience, ...song,
    });
    if (error) throw error;
    tidy(user.id);
    return data;
  } catch (e) {
    if (uploaded.length) sb().storage.from(BUCKET).remove(uploaded).catch(() => {});
    throw e;
  }
}

/* ---------- shareable scratch links: anyone can open them, no account needed ---------- */

const LINK_BUCKET = 'sota-scratch-links';
export const SITE = 'https://sotakece.com';

export function linkError(e) {
  const m = String(e?.message || e || '');
  if (/LINK_LIMIT/.test(m)) return 'That is 30 links today. Try again tomorrow.';
  if (/bv_scratch_link_create|PGRST202|Could not find the function|Bucket not found/i.test(m)) return 'Sharing as a link is not switched on yet.';
  return postError(e);
}

/** Make a public scratch link for the current story. Returns {url, path}. */
export async function makeScratchLink({ caption }, story, progress = () => {}) {
  const user = await member();
  if (!user) throw new Error('NOT_SIGNED_IN');
  const S = story.state();
  if (!S.song) throw new Error('SONG_BAD');
  const stem = `${user.id}/${newId()}`, uploaded = [];
  try {
    progress('Getting the layers ready…');
    const l = await story.scratchLayers({ coverType: 'image/jpeg' });   // the cover is the link preview: JPEG shows everywhere
    progress('Making your link…');
    for (const [suffix, blob] of [['-under', l.under], ['-cover', l.cover], ['-over', l.over]]) {
      const ext = extFor(blob?.type);
      if (!ext) throw new Error('mime type not supported');
      const path = `${stem}${suffix}.${ext}`;
      const { error } = await sb().storage.from(LINK_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '31536000' });
      if (error) throw error;
      uploaded.push(path);
    }
    const { data, error } = await sb().rpc('bv_scratch_link_create', {
      p_stem: stem, p_song_id: S.song.id, p_song_start: Math.round(S.start || 0), p_caption: (caption || '').trim() || null,
    });
    if (error) throw error;
    return { url: SITE + data.path, path: data.path };
  } catch (e) {
    if (uploaded.length) sb().storage.from(LINK_BUCKET).remove(uploaded).catch(() => {});
    throw e;
  }
}

/* ---------- the "Post to Sota Stories" part of the Save tab ---------- */

const $ = (id) => document.getElementById(id);
function chips(host, items, current, onPick) {
  host.textContent = '';
  for (const [key, label] of Object.entries(items)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ss-chip'; b.textContent = label; b.setAttribute('aria-pressed', String(key === current));
    b.addEventListener('click', () => onPick(key));
    host.append(b);
  }
}

export async function mountPostPanel(story) {
  if (!$('ss-post')) return;
  const P = { kind: 'scratch', audience: 'friends', busy: false };
  const help = {
    scratch: 'Friends see your cover and scratch it themselves to hear the song.',
    video: 'Friends watch the video of your scratch, with the music.',
    picture: 'Friends see one still picture.',
  };
  const paint = () => {
    chips($('ss-post-kind'), KINDS, P.kind, (k) => { P.kind = k; paint(); });
    chips($('ss-post-aud'), AUDIENCES, P.audience, (k) => { P.audience = k; paint(); });
    $('ss-post-help').textContent = help[P.kind];
  };
  paint();
  const user = await member();
  $('ss-post-signin').hidden = !!user;
  $('ss-post-btn').disabled = !user;
  $('ss-post-btn').addEventListener('click', async () => {
    if (P.busy) return;
    P.busy = true; $('ss-post-btn').disabled = true;
    const note = (t) => { $('ss-post-status').textContent = t; };
    try {
      await postStory({ kind: P.kind, audience: P.audience, caption: $('ss-post-caption').value }, story, note);
      note('');
      $('ss-post-caption').value = '';
      $('ss-post-done').hidden = false;
      story.say(P.audience === 'close' ? 'Posted to your story for close friends, for 24 hours.' : 'Posted to your story for 24 hours.');
    } catch (e) {
      note(postError(e));
    } finally {
      P.busy = false; $('ss-post-btn').disabled = false;
    }
  });

  // Share as a link
  $('ss-link-btn').disabled = !user;
  $('ss-link-btn').addEventListener('click', async () => {
    if (P.busy) return;
    P.busy = true; $('ss-link-btn').disabled = true;
    const note = (t) => { $('ss-link-status').textContent = t; };
    try {
      const { url } = await makeScratchLink({ caption: $('ss-post-caption').value }, story, note);
      note('');
      $('ss-link-out').value = url; $('ss-link-box').hidden = false;
      const name = story.songTitle();
      const data = { title: 'A song to scratch · Sota Kece', text: name ? `Scratch this to hear a song I picked 🎵` : 'Scratch this 🎵', url };
      if (navigator.share) { try { await navigator.share(data); story.say('Link shared. You will see in Activity when someone joins through it.'); return; } catch (e) { if (e?.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(url); story.say('Link copied. Paste it into WhatsApp, Messenger or anywhere.'); }
      catch (_) { story.say('Your link is ready below. Copy it and send it to friends.'); }
    } catch (e) {
      note(linkError(e));
    } finally {
      P.busy = false; $('ss-link-btn').disabled = false;
    }
  });
  $('ss-link-copy').addEventListener('click', async () => {
    const v = $('ss-link-out').value; if (!v) return;
    try { await navigator.clipboard.writeText(v); story.say('Link copied.'); } catch (_) { $('ss-link-out').select(); }
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const start = () => (window.SongScratchStory ? mountPostPanel(window.SongScratchStory) : setTimeout(start, 50));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}
