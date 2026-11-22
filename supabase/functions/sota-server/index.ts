// sota-server: the Sota Kece Worker's narrow door to the service role (dimau-core-ireland since 21 Nov 2026;
// the same code also still runs on dimau-core-sydney, read-only fallback).
//
// The Cloudflare Worker (api/sere.js, api/sere-callback.js, api/listen.js, api/account-delete.js) no
// longer holds the Supabase service key. It sends the same REST and storage requests it used to send
// to Supabase, to this function instead, with the header x-sota-bridge: <SOTA_SERVER_SECRET>.
// This function checks that header, checks the request against the short list below, and only then
// repeats it to Supabase with the service key it is given automatically (SUPABASE_SERVICE_ROLE_KEY).
// Anything not on the list is refused, so the shared secret is worth far less than the service key.
//
// Only the SHA-256 of the shared secret is kept here (a hash of 32 random bytes reveals nothing).
// To change the secret: make a new random value, set it as the Worker secret SOTA_SERVER_SECRET
// and put its SHA-256 below, then deploy this function. Deploy with verify_jwt off.
const SECRET_SHA256 = "b97125921d10123dfbeb85305ccf571f587eca5ca18a49b45c929491ff3f99dc";

const BASE = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const UPLOAD_BUCKETS = ["sere-video", "sere-images", "sere-audio", "bv-room-media", "profile-photos", "talanoa-voice", "sota-stories"];
const PATH = "[A-Za-z0-9._/-]{1,300}";
const JOB_COLUMNS = new Set(["status", "progress", "error", "output_video_url", "output_poster_url", "provider", "provider_job_id", "attempts", "audio_url"]);

type Rule = { method: string; path: RegExp; query?: (q: URLSearchParams) => boolean; body?: (b: unknown) => boolean };
const only = (q: URLSearchParams, allowed: Record<string, RegExp>) =>
  [...q.keys()].every((k) => allowed[k] && q.getAll(k).length === 1 && allowed[k].test(q.get(k)!));
const jobQuery = (q: URLSearchParams) =>
  q.has("id") && only(q, { id: new RegExp(`^eq\\.${UUID}$`, "i"), status: /^eq\.[a-z]{1,20}$/, select: /^[a-z_,*]{1,200}$/ });

const RULES: Rule[] = [
  // api/sere.js getJob, api/listen.js readSere
  { method: "GET", path: /^\/rest\/v1\/bv_sere_media_generations$/, query: jobQuery },
  // api/sere.js patchJob (one row, by id, only the job columns)
  { method: "PATCH", path: /^\/rest\/v1\/bv_sere_media_generations$/,
    query: (q) => jobQuery(q) && !q.has("select"),
    body: (b) => !!b && typeof b === "object" && !Array.isArray(b) && Object.keys(b as object).length > 0 && Object.keys(b as object).every((k) => JOB_COLUMNS.has(k)) },
  // api/listen.js: the maker's first name for the share page
  { method: "GET", path: /^\/rest\/v1\/bv_profiles$/,
    query: (q) => q.has("id") && only(q, { id: new RegExp(`^eq\\.${UUID}$`, "i"), select: /^display_name,handle$/ }) },
  // api/account-delete.js: list and delete a member's files
  { method: "POST", path: new RegExp(`^/storage/v1/object/list/(${UPLOAD_BUCKETS.join("|")})$`) },
  { method: "DELETE", path: new RegExp(`^/storage/v1/object/(${UPLOAD_BUCKETS.join("|")})$`) },
  // api/sere.js: sign the two inputs for the render, copy a remixed sound, store results, read the poster
  { method: "POST", path: new RegExp(`^/storage/v1/object/sign/(sere-images|sere-audio)/${PATH}$`) },
  { method: "POST", path: /^\/storage\/v1\/object\/copy$/, body: (b) => (b as { bucketId?: string })?.bucketId === "sere-audio" },
  { method: "POST", path: new RegExp(`^/storage/v1/object/(sere-video|sere-audio)/${PATH}$`) },
  { method: "GET", path: new RegExp(`^/storage/v1/object/sere-images/${PATH}$`) },
];
const FORWARD_HEADERS = ["content-type", "x-upsert", "cache-control", "prefer"];

async function sha256(text: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...d].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
const answer = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

Deno.serve(async (req) => {
  const given = req.headers.get("x-sota-bridge") ?? "";
  if (given.length < 32 || !same(await sha256(given), SECRET_SHA256)) return answer(401, "not allowed");

  const url = new URL(req.url);
  const at = url.pathname.indexOf("/sota-server");
  const path = at >= 0 ? url.pathname.slice(at + "/sota-server".length) : url.pathname;
  if (path.includes("..") || path.includes("//")) return answer(400, "bad path");
  const rule = RULES.find((r) => r.method === req.method && r.path.test(path));
  if (!rule) return answer(403, "not on the list");
  if (rule.query ? !rule.query(url.searchParams) : url.search !== "") return answer(403, "query not allowed");

  let body: BodyInit | undefined;
  if (req.method !== "GET") {
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (rule.body) {
      let parsed: unknown;
      try { parsed = JSON.parse(new TextDecoder().decode(bytes)); } catch { return answer(400, "bad body"); }
      if (!rule.body(parsed)) return answer(403, "body not allowed");
    }
    body = bytes;
  }
  const headers = new Headers({ apikey: KEY, Authorization: `Bearer ${KEY}` });
  for (const h of FORWARD_HEADERS) { const v = req.headers.get(h); if (v) headers.set(h, v); }

  const upstream = await fetch(BASE + path + url.search, { method: req.method, headers, body });
  const out = new Headers({ "cache-control": "no-store" });
  const type = upstream.headers.get("content-type");
  if (type) out.set("content-type", type);
  return new Response(upstream.body, { status: upstream.status, headers: out });
});
