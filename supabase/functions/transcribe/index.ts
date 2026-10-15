// Ритм — распознавание записи голоса (запасной путь, если iPhone не распознаёт сам).
// Нужен секрет OPENAI_API_KEY (или GROQ_API_KEY).
import { createClient } from "jsr:@supabase/supabase-js@2";
const CORS = { "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://dashasmartnet-dot.github.io", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "x");
  const { data: u } = jwt ? await sb.auth.getUser(jwt) : { data: null };
  if (!u?.user) return json({ code: "session_expired" }, 401);
  const audio = await req.blob();
  if (!audio.size) return json({ error: "empty" }, 400);
  if (audio.size > 24_000_000) return json({ code: "prompt_too_large" }, 413);
  const groq = Deno.env.get("GROQ_API_KEY"), openai = Deno.env.get("OPENAI_API_KEY");
  if (!groq && !openai) return json({ code: "no_key" }, 503);
  const ext = (audio.type || "").includes("webm") ? "webm" : "m4a";
  const fd = new FormData();
  fd.append("file", new File([audio], "voice." + ext, { type: audio.type || "audio/mp4" }));
  fd.append("model", groq ? "whisper-large-v3-turbo" : "whisper-1");
  fd.append("language", "ru");
  const r = await fetch(groq ? "https://api.groq.com/openai/v1/audio/transcriptions" : "https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + (groq || openai) }, body: fd });
  if (!r.ok) { console.error("stt", r.status, (await r.text()).slice(0, 300)); return json({ code: "stt_error" }, 502); }
  const d = await r.json();
  return json({ text: d.text || "" });
});
