export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}

function clean(v: unknown, max: number) {
  return String(v ?? "").trim().slice(0, max);
}

async function handleApi(request: Request, env: Env) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/community") {
    const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM members").first<{count:number}>();
    return json({ count: Number(row?.count ?? 0), target: 1000000 });
  }

  if (request.method === "POST" && url.pathname === "/api/register") {
    let body: any;
    try { body = await request.json(); } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const name = clean(body?.name, 120);
    const phone = clean(body?.phone, 30);
    const utr = clean(body?.utr, 80);

    if (name.length < 2 || phone.length < 5) {
      return json({ error: "Name and contact number are required." }, 400);
    }

    // Basic duplicate protection for the same phone.
    const existing = await env.DB.prepare(
      "SELECT id FROM members WHERE phone = ? LIMIT 1"
    ).bind(phone).first();

    if (existing) {
      return json({ ok: true, alreadyRegistered: true });
    }

    await env.DB.prepare(
      "INSERT INTO members (name, phone, utr) VALUES (?, ?, ?)"
    ).bind(name, phone, utr || null).run();

    const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM members")
      .first<{count:number}>();

    return json({ ok: true, count: Number(row?.count ?? 0) }, 201);
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env);
      } catch (e) {
        return json({ error: "Server error" }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
