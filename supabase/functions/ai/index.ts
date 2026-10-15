// Ритм — функция ИИ. Бесплатные облачные модели с автоматическим переключением:
// Groq → Google Gemini Flash → OpenRouter (бесплатные модели) → Anthropic (если задан ключ).
// Ключи хранятся только в секретах Supabase: GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, ANTHROPIC_API_KEY.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://dashasmartnet-dot.github.io";
const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") || 150);
const env = (k: string) => Deno.env.get(k) || "";

type Msg = { role: "user" | "assistant"; content: string };
type Provider = { name: string; url: string; key: string; model: string; quickModel: string; headers?: Record<string, string> };

function providers(): Provider[] {
  const list: Provider[] = [];
  if (env("GROQ_API_KEY")) list.push({
    name: "groq", url: "https://api.groq.com/openai/v1/chat/completions", key: env("GROQ_API_KEY"),
    model: env("GROQ_MODEL") || "openai/gpt-oss-120b", quickModel: env("GROQ_MODEL_QUICK") || "llama-3.3-70b-versatile",
  });
  if (env("GEMINI_API_KEY")) list.push({
    name: "gemini", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: env("GEMINI_API_KEY"),
    model: env("GEMINI_MODEL") || "gemini-flash-latest", quickModel: env("GEMINI_MODEL_QUICK") || "gemini-flash-lite-latest",
  });
  if (env("OPENROUTER_API_KEY")) list.push({
    name: "openrouter", url: "https://openrouter.ai/api/v1/chat/completions", key: env("OPENROUTER_API_KEY"),
    model: env("OPENROUTER_MODEL") || "meta-llama/llama-3.3-70b-instruct:free", quickModel: env("OPENROUTER_MODEL") || "meta-llama/llama-3.3-70b-instruct:free",
    headers: { "HTTP-Referer": ORIGIN, "X-Title": "Ritm" },
  });
  return list;
}

function normalize(messages: Msg[]): Msg[] {
  const out: Msg[] = [];
  for (const m of messages || []) {
    const role = m.role === "assistant" ? "assistant" : "user";
    const content = String(m.content || "").slice(0, 60000);
    if (!content) continue;
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += "\n\n" + content;
    else out.push({ role, content });
  }
  if (out.length && out[0].role !== "user") out.unshift({ role: "user", content: "Привет" });
  return out;
}

// Пересылаем клиенту только текст из потока SSE.
function textStream(body: ReadableStream<Uint8Array>, pick: (ev: any) => string | undefined): ReadableStream<Uint8Array> {
  const reader = body.getReader(); const dec = new TextDecoder(); const enc = new TextEncoder(); let buf = "";
  return new ReadableStream({
    async pull(ctrl) {
      const { done, value } = await reader.read();
      if (done) { ctrl.close(); return; }
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() || "";
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith("data:")) continue;
        const data = l.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try { const t = pick(JSON.parse(data)); if (t) ctrl.enqueue(enc.encode(t)); } catch { /* skip */ }
      }
    },
    cancel() { reader.cancel(); },
  });
}

async function callOpenAICompat(p: Provider, system: string, messages: Msg[], o: { quick: boolean; json: boolean; stream: boolean }) {
  const body: Record<string, unknown> = {
    model: o.quick ? p.quickModel : p.model,
    messages: [{ role: "system", content: system }, ...messages],
    max_tokens: o.json ? 4000 : 2000,
    temperature: o.json ? 0.2 : 0.7,
    stream: o.stream,
  };
  if (o.json && p.name !== "openrouter") body.response_format = { type: "json_object" };
  const r = await fetch(p.url, {
    method: "POST",
    headers: { Authorization: "Bearer " + p.key, "content-type": "application/json", ...(p.headers || {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) throw new Error(p.name + " " + r.status + " " + (await r.text()).slice(0, 300));
  if (o.stream && r.body) return { stream: textStream(r.body, (ev) => ev.choices?.[0]?.delta?.content) };
  const d = await r.json();
  const text = d.choices?.[0]?.message?.content || "";
  if (!text) throw new Error(p.name + " empty");
  return { text };
}

async function callAnthropic(system: string, messages: Msg[], o: { quick: boolean; json: boolean; stream: boolean }) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: o.quick ? (env("ANTHROPIC_MODEL_QUICK") || "claude-haiku-5-5") : (env("ANTHROPIC_MODEL") || "claude-sonnet-5-5"),
      max_tokens: o.json ? 4000 : 2000, system, messages, stream: o.stream,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw new Error("anthropic " + r.status + " " + (await r.text()).slice(0, 300));
  if (o.stream && r.body) return { stream: textStream(r.body, (ev) => ev.type === "content_block_delta" && ev.delta?.type === "text_delta" ? ev.delta.text : undefined) };
  const d = await r.json();
  return { text: (d.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // только вошедший пользователь
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const url = env("SUPABASE_URL");
  const anon = createClient(url, env("SUPABASE_ANON_KEY") || env("SUPABASE_PUBLISHABLE_KEY") || "x");
  const { data: u } = jwt ? await anon.auth.getUser(jwt) : { data: null };
  if (!u?.user) return json({ error: "auth", code: "session_expired" }, 401);

  // дневной лимит на человека (защита бесплатных квот от злоупотреблений)
  const svcKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (svcKey) {
    const admin = createClient(url, svcKey);
    const day = new Date().toISOString().slice(0, 10);
    const { data: row } = await admin.from("ai_usage").select("n").eq("user_id", u.user.id).eq("day", day).maybeSingle();
    const n = (row?.n || 0) + 1;
    if (n > DAILY_LIMIT) return json({ error: "limit", code: "rate_limited" }, 429);
    await admin.from("ai_usage").upsert({ user_id: u.user.id, day, n });
  }

  let body: { messages: Msg[]; tier?: string; json?: boolean; stream?: boolean };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const messages = normalize(body.messages);
  if (!messages.length) return json({ error: "empty" }, 400);
  if (JSON.stringify(messages).length > 200000) return json({ error: "too large", code: "prompt_too_large" }, 413);

  const system =
    "Ты — встроенный помощник приложения-планировщика «Ритм». Пиши по-русски, тепло и по делу. Сегодня " +
    new Date().toISOString().slice(0, 10) + "." +
    (body.json ? " Отвечай строго одним валидным JSON-объектом без пояснений и без markdown." : "");
  const o = { quick: body.tier === "quick", json: !!body.json, stream: !!body.stream && !body.json };

  const errors: string[] = [];
  for (const p of providers()) {
    try {
      const r = await callOpenAICompat(p, system, messages, o);
      const headers = { ...CORS, "X-Ritm-Provider": p.name, "Access-Control-Expose-Headers": "X-Ritm-Provider" };
      if ("stream" in r && r.stream) return new Response(r.stream, { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" } });
      return new Response(JSON.stringify({ text: (r as any).text, provider: p.name }), { headers: { ...headers, "Content-Type": "application/json" } });
    } catch (e) { errors.push(String(e).slice(0, 300)); }
  }
  if (env("ANTHROPIC_API_KEY")) {
    try {
      const r = await callAnthropic(system, messages, o);
      if ("stream" in r && r.stream) return new Response(r.stream, { headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } });
      return json({ text: (r as any).text, provider: "anthropic" });
    } catch (e) { errors.push(String(e).slice(0, 300)); }
  }
  console.error("all providers failed", errors);
  if (!errors.length) return json({ error: "no key", code: "sampling_disabled" }, 503);
  return json({ error: "ai", code: errors.some((x) => / 429 /.test(x)) ? "rate_limited" : "ai_error" }, 502);
});
