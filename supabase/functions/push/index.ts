// Ритм — пуш-напоминания. Ключи VAPID создаются один раз автоматически и хранятся в базе (доступ только у сервера).
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://dashasmartnet-dot.github.io";
const CORS = { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Vary": "Origin" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) || "";
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

async function vapid() {
  const { data } = await admin.from("app_secrets").select("name,value").in("name", ["vapid_public", "vapid_private"]);
  const m: Record<string, string> = {}; (data || []).forEach((r: any) => m[r.name] = r.value);
  if (m.vapid_public && m.vapid_private) return { pub: m.vapid_public, priv: m.vapid_private };
  const k = webpush.generateVAPIDKeys();
  await admin.from("app_secrets").insert([{ name: "vapid_public", value: k.publicKey }, { name: "vapid_private", value: k.privateKey }]);
  const again = await admin.from("app_secrets").select("name,value").in("name", ["vapid_public", "vapid_private"]);
  const m2: Record<string, string> = {}; (again.data || []).forEach((r: any) => m2[r.name] = r.value);
  return { pub: m2.vapid_public, priv: m2.vapid_private };
}

async function sendTo(userId: string, payload: unknown, keys: { pub: string; priv: string }) {
  webpush.setVapidDetails("mailto:noreply@ritm.app", keys.pub, keys.priv);
  const { data: subs } = await admin.from("push_subs").select("endpoint,sub").eq("user_id", userId);
  let ok = 0;
  for (const s of subs || []) {
    try { await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 3600, urgency: "high" }); ok++; }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from("push_subs").delete().eq("endpoint", s.endpoint); else console.error("push", e?.statusCode, String(e?.body || e).slice(0, 200)); }
  }
  return ok;
}

async function userFrom(req: Request) {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  return data?.user || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const keys = await vapid();
  if (req.method === "GET") return json({ publicKey: keys.pub });
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }

  if (body.cron) {
    const now = new Date();
    const { data: due } = await admin.from("reminders").select("*").is("sent_at", null).lte("fire_at", now.toISOString()).gte("fire_at", new Date(now.getTime() - 30 * 60000).toISOString()).limit(200);
    let sent = 0;
    const states: Record<string, any> = {};
    for (const r of due || []) {
      if (!(r.user_id in states)) { const { data } = await admin.from("states").select("data").eq("user_id", r.user_id).maybeSingle(); states[r.user_id] = data?.data || null; }
      const tasks = (states[r.user_id]?.tasks || []) as any[];
      if (String(r.task_id).startsWith("habits:")) {
        const st = states[r.user_id] || {};
        const log = (st.habitLog || {})[r.due] || {};
        const left = ((st.habits || []) as any[]).filter((h) => !log[h.id]).map((h) => h.name);
        if (st.habRemind?.on && left.length) sent += await sendTo(r.user_id, { title: "Каждый день", body: "Ещё не отмечено: " + left.slice(0, 6).join(", "), tag: "habits" }, keys);
        await admin.from("reminders").update({ sent_at: now.toISOString() }).eq("id", r.id);
        continue;
      }
      if (String(r.task_id).startsWith("brief:")) {
        const st = states[r.user_id] || {};
        if (st.briefPush !== false) {
          const day = r.due as string;
          const open = tasks.filter((x) => !x.done && x.kind !== "wait" && x.due && x.due <= day);
          const pr = (x: any) => (x.priority || 2);
          const timed = open.filter((x) => x.time && x.due === day).sort((a, b) => a.time.localeCompare(b.time));
          const key = open.filter((x) => x.kind === "main" && !(x.time && x.due === day)).sort((a, b) => pr(a) - pr(b)).slice(0, 3);
          const small = open.filter((x) => x.kind === "small").length;
          const parts: string[] = [];
          if (key.length) parts.push("Главное: " + key.map((x) => x.title).join(" · "));
          if (timed.length) parts.push("По времени: " + timed.slice(0, 3).map((x) => x.time + " " + x.title).join(" · "));
          if (small) parts.push("Мелочей: " + small);
          const body = parts.length ? parts.join("\n") : "На сегодня дел нет. Загляни — можно взять что-то заранее.";
          sent += await sendTo(r.user_id, { title: "План на день" + (open.length ? " · " + open.length : ""), body, tag: "brief" }, keys);
        }
        await admin.from("reminders").update({ sent_at: now.toISOString() }).eq("id", r.id);
        continue;
      }
      const t = tasks.find((x) => x.id === r.task_id);
      const still = t && !t.done && t.due === r.due && (t.time || null) === (r.at_time || null);
      if (still) {
        const mins = Math.round((new Date(`${r.due}T${r.at_time}:00`).getTime() - new Date(r.fire_at).getTime()) / 60000);
        sent += await sendTo(r.user_id, { title: t.title, body: r.at_time ? (Math.abs(mins) > 1 ? `В ${r.at_time}` : `Сейчас, ${r.at_time}`) : "Напоминание", tag: r.task_id }, keys);
      }
      await admin.from("reminders").update({ sent_at: now.toISOString() }).eq("id", r.id);
    }
    // старые несработавшие помечаем, чтобы не копились
    await admin.from("reminders").update({ sent_at: now.toISOString() }).is("sent_at", null).lt("fire_at", new Date(now.getTime() - 30 * 60000).toISOString());
    return json({ checked: (due || []).length, sent });
  }

  const user = await userFrom(req);
  if (!user) return json({ code: "session_expired" }, 401);
  if (body.test) {
    const n = await sendTo(user.id, { title: "Ритм", body: "Напоминания работают ✓", tag: "test" }, keys);
    return json({ sent: n });
  }
  return json({ error: "unknown" }, 400);
});
