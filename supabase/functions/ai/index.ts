// Ритм — функция ИИ. Ключ хранится только в секретах Supabase (ANTHROPIC_API_KEY или OPENROUTER_API_KEY).
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://dashasmartnet-dot.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
const MODEL_QUICK = Deno.env.get("ANTHROPIC_MODEL_QUICK") || "claude-haiku-5-5";

type Msg = { role: "user" | "assistant"; content: string };

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // только вошедший пользователь
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "x");
  const { data: u } = jwt ? await sb.auth.getUser(jwt) : { data: null };
  if (!u?.user) return json({ error: "auth", code: "session_expired" }, 401);

  let body: { messages: Msg[]; tier?: string; json?: boolean; stream?: boolean };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const messages = normalize(body.messages);
  if (!messages.length) return json({ error: "empty" }, 400);
  if (JSON.stringify(messages).length > 400000) return json({ error: "too large", code: "prompt_too_large" }, 413);

  const system =
    "Ты — встроенный помощник приложения-планировщика «Ритм». Пиши по-русски." +
    (body.json ? " Отвечай строго валидным JSON без пояснений и без markdown." : "");
  const quick = body.tier === "quick";

  if (ANTHROPIC_KEY) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: quick ? MODEL_QUICK : MODEL,
        max_tokens: body.json ? 4000 : 2000,
        system,
        messages,
        stream: !!body.stream,
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("anthropic", r.status, t.slice(0, 500));
      return json({ error: "ai", code: r.status === 429 ? "rate_limited" : "ai_error" }, r.status === 429 ? 429 : 502);
    }
    if (body.stream && r.body) {
      // пересылаем клиенту только текст
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      const enc = new TextEncoder();
      let buf = "";
      const stream = new ReadableStream({
        async pull(ctrl) {
          const { done, value } = await reader.read();
          if (done) { ctrl.close(); return; }
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            try {
              const ev = JSON.parse(line.slice(5));
              if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") ctrl.enqueue(enc.encode(ev.delta.text));
            } catch { /* skip */ }
          }
        },
        cancel() { reader.cancel(); },
      });
      return new Response(stream, { headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" } });
    }
    const d = await r.json();
    const text = (d.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    return json({ text });
  }

  if (OPENROUTER_KEY) {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + OPENROUTER_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENROUTER_MODEL") || (quick ? "anthropic/claude-haiku-5.5" : "anthropic/claude-sonnet-5.5"),
        messages: [{ role: "system", content: system }, ...messages],
        max_tokens: body.json ? 4000 : 2000,
      }),
    });
    if (!r.ok) {
      console.error("openrouter", r.status, (await r.text()).slice(0, 500));
      return json({ error: "ai", code: r.status === 429 ? "rate_limited" : "ai_error" }, r.status === 429 ? 429 : 502);
    }
    const d = await r.json();
    return json({ text: d.choices?.[0]?.message?.content || "" });
  }

  return json({ error: "no key", code: "sampling_disabled" }, 503);
});
