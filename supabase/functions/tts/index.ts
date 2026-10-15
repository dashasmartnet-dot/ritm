// Ритм — озвучка ответов живым голосом (Gemini TTS). Ключ GEMINI_API_KEY хранится в секретах Supabase.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://dashasmartnet-dot.github.io";
const CORS = { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) || "";

function b64ToBytes(b64: string) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function bytesToB64(u: Uint8Array) { let s = ""; const CH = 0x8000; for (let i = 0; i < u.length; i += CH) s += String.fromCharCode(...u.subarray(i, i + CH)); return btoa(s); }
function wav(pcm: Uint8Array, rate = 24000) {
  const h = new ArrayBuffer(44); const v = new DataView(h);
  const w = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + pcm.length, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length); out.set(new Uint8Array(h), 0); out.set(pcm, 44); return out;
}

async function viaInteractions(text: string, voice: string, model: string) {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
    body: JSON.stringify({ model, input: [{ type: "user_input", content: [{ type: "text", text }] }], response_format: { type: "audio" }, generation_config: { speech_config: [{ voice }] } }),
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error("interactions " + r.status + " " + (await r.text()).slice(0, 200));
  const d = await r.json();
  const find = (o: any): string | null => { if (!o || typeof o !== "object") return null; if (typeof o.data === "string" && o.data.length > 1000) return o.data; for (const k of Object.keys(o)) { const x = find(o[k]); if (x) return x; } return null; };
  const b64 = find(d); if (!b64) throw new Error("no audio");
  const bytes = b64ToBytes(b64);
  const isWav = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  return isWav ? bytes : wav(bytes);
}
async function viaGenerate(text: string, voice: string, model: string) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
    body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error("generate " + r.status + " " + (await r.text()).slice(0, 200));
  const d = await r.json();
  const b64 = d?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
  if (!b64) throw new Error("no audio");
  return wav(b64ToBytes(b64));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const anon = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY") || "x");
  const { data: u } = jwt ? await anon.auth.getUser(jwt) : { data: null };
  if (!u?.user) return json({ code: "session_expired" }, 401);
  if (!env("GEMINI_API_KEY")) return json({ code: "no_key" }, 503);
  let body: any = {}; try { body = await req.json(); } catch { /* */ }
  const text = String(body.text || "").slice(0, 1200).trim();
  if (!text) return json({ error: "empty" }, 400);
  const voice = /^[A-Z][a-z]+$/.test(body.voice || "") ? body.voice : "Kore";
  const prompt = "Прочитай по-русски тёплым, живым, спокойным голосом, как заботливая помощница, в естественном темпе:\n" + text;
  const tries: [string, (t: string, v: string, m: string) => Promise<Uint8Array>, string][] = [
    ["interactions", viaInteractions, env("TTS_MODEL") || "gemini-3.8-flash-lite-tts"],
    ["interactions", viaInteractions, "gemini-3.8-flash-tts"],
    ["generate", viaGenerate, "gemini-2.5-flash-preview-tts"],
  ];
  const errs: string[] = [];
  for (const [, fn, model] of tries) {
    try { const audio = await fn(prompt, voice, model); return json({ audio: bytesToB64(audio), mime: "audio/wav", model }); }
    catch (e) { errs.push(model + ": " + String(e).slice(0, 200)); }
  }
  console.error("tts failed", errs);
  return json({ code: "tts_error", errs }, 502);
});
