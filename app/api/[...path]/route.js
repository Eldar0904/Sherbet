import { NextResponse } from "next/server.js";
import { randomUUID } from "node:crypto";
import { pool, ready, settings } from "../../../lib/db.js";
import { admin, same, token } from "../../../lib/auth.js";
import rules from "../../../lib/rules.cjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const demo = [
  {
    id: 1,
    title: "Курица с овощами",
    description: "Нежное филе, запечённые овощи и рис",
    kind: "main",
    price: 1000,
    active: true,
    art: "bowl",
  },
  {
    id: 2,
    title: "Домашний плов",
    description: "Рассыпчатый рис, говядина и специи",
    kind: "main",
    price: 1000,
    active: true,
    art: "rice",
  },
  {
    id: 3,
    title: "Самса из печи",
    description: "Хрустящее тесто и сочная начинка",
    kind: "bake",
    price: 700,
    active: true,
    art: "pastry",
  },
];
const json = (value, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
function withClient(response, req) {
  if (!req.cookies.get("sherbet_client"))
    response.cookies.set("sherbet_client", randomUUID(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 31536000,
    });
  return response;
}

async function handle(req, context) {
  const { path } = await context.params;
  const route = path.join("/");
  const method = req.method;
  const isAdmin = admin(req);
  if (
    method !== "GET" &&
    req.headers.get("origin") &&
    req.headers.get("origin") !== new URL(req.url).origin
  )
    return json({ error: "Недопустимый источник запроса." }, 403);
  try {
    if (route === "session") {
      if (method === "GET") return json({ admin: isAdmin });
      if (method === "DELETE") {
        const r = json({ ok: true });
        r.cookies.set("sherbet_admin", "", { maxAge: 0, path: "/" });
        return r;
      }
      if (method === "POST") {
        const body = await req.json();
        if (!same(String(body.pin || ""), process.env.ADMIN_PIN))
          return json({ error: "Неверный пароль администратора." }, 401);
        const r = json({ ok: true });
        r.cookies.set("sherbet_admin", token(), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          maxAge: 28800,
        });
        return r;
      }
    }
    if (route === "menu" && method === "GET" && !process.env.DATABASE_URL)
      return json({
        dishes: demo,
        settings: {
          forceOpen: true,
          mainClose: 720,
          bakeClose: 720,
          menuUpdatedDay: rules.clock().day,
        },
        demo: true,
        day: rules.clock().day,
      });
    if (route === "cron/archive") {
      if (
        method !== "GET" ||
        !same(
          req.headers.get("authorization"),
          process.env.CRON_SECRET && "Bearer " + process.env.CRON_SECRET,
        )
      )
        return json({ error: "Unauthorized" }, 401);
      await ready();
      const r = await pool().query(
        "UPDATE sherbet.orders SET archived=true WHERE order_day<$1 AND archived=false",
        [rules.clock().day],
      );
      return json({ ok: true, archived: r.rowCount });
    }
    if (route.startsWith("orders/") && method === "DELETE" && !isAdmin)
      return json({ error: "Войдите как администратор." }, 401);
    if (["dishes", "settings", "archive"].includes(route) && !isAdmin)
      return json({ error: "Войдите как администратор." }, 401);
    await ready();
    if (route === "health" && method === "GET") return json({ ok: true });
    if (route === "menu" && method === "GET") {
      const { rows } = await pool().query(
        "SELECT * FROM sherbet.dishes ORDER BY id",
      );
      return withClient(
        json({
          dishes: rows.filter((d) => isAdmin || d.active),
          settings: await settings(),
          demo: false,
          day: rules.clock().day,
        }),
        req,
      );
    }
    if (route === "dishes" && method === "POST") {
      const b = await req.json();
      if (
        typeof b.title !== "string" ||
        !b.title.trim() ||
        b.title.length > 120 ||
        !["main", "bake"].includes(b.kind) ||
        !Number.isInteger(b.price) ||
        b.price < 0 ||
        b.price > 100000
      )
        return json({ error: "Проверьте название, категорию и цену." }, 400);
      const values = [
        b.title.trim(),
        String(b.description || "").slice(0, 240),
        b.kind,
        b.price,
        !!b.active,
        ["bowl", "rice", "pastry", "salad"].includes(b.art)
          ? b.art
          : b.kind === "bake"
            ? "pastry"
            : "bowl",
      ];
      if (b.id) {
        if (!Number.isInteger(b.id))
          return json({ error: "Некорректное блюдо." }, 400);
        await pool().query(
          "UPDATE sherbet.dishes SET title=$1,description=$2,kind=$3,price=$4,active=$5,art=$6 WHERE id=$7",
          [...values, b.id],
        );
      } else
        await pool().query(
          "INSERT INTO sherbet.dishes(title,description,kind,price,active,art) VALUES($1,$2,$3,$4,$5,$6)",
          values,
        );
      await pool().query(
        "UPDATE sherbet.settings SET menu_updated_day=$1,main_close=720,bake_close=720 WHERE id=1",
        [rules.clock().day],
      );
      return json({ ok: true });
    }
    if (route === "settings" && method === "PUT") {
      const b = await req.json();
      if (
        ![b.mainClose, b.bakeClose].every(
          (x) => Number.isInteger(x) && x >= 0 && x < 1440,
        )
      )
        return json({ error: "Укажите корректное время." }, 400);
      await pool().query(
        "UPDATE sherbet.settings SET force_open=$1,main_close=$2,bake_close=$3 WHERE id=1",
        [!!b.forceOpen, b.mainClose, b.bakeClose],
      );
      return json({ ok: true });
    }
    if (route === "orders" && method === "GET") {
      const client = req.cookies.get("sherbet_client")?.value;
      const day = new URL(req.url).searchParams.get("day") || rules.clock().day;
      if (!isAdmin && !client) return json({ orders: [] });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
        return json({ error: "Некорректная дата." }, 400);
      const { rows } = await pool().query(
        "SELECT id,customer,note,items,total,paid,order_day::text,archived,created_at FROM sherbet.orders WHERE order_day=$1 AND ($2::boolean OR client_id=$3::uuid) ORDER BY id DESC",
        [day, isAdmin, client || null],
      );
      return json({ orders: rows });
    }
    if (route === "orders" && method === "POST") {
      const b = await req.json();
      try {
        rules.validateOrder(b);
      } catch (e) {
        return json({ error: e.message }, 400);
      }
      const clientId = req.cookies.get("sherbet_client")?.value || randomUUID();
      const c = await pool().connect();
      try {
        await c.query("BEGIN");
        const existing = await c.query(
          "SELECT id FROM sherbet.orders WHERE request_id=$1 AND client_id=$2",
          [b.requestId, clientId],
        );
        if (existing.rows.length) {
          await c.query("COMMIT");
          return json({ ok: true, id: existing.rows[0].id });
        }
        const config = await settings(c);
        const { rows } = await c.query(
          "SELECT * FROM sherbet.dishes WHERE id=ANY($1::int[]) FOR SHARE",
          [b.items.map((i) => i.id)],
        );
        const items = [];
        for (const i of b.items) {
          const d = rows.find((d) => d.id === i.id);
          if (!d || !d.active || rules.isClosed(d.kind, config)) {
            await c.query("ROLLBACK");
            return json(
              { error: "Приём этого блюда закрыт. Обновите меню." },
              409,
            );
          }
          items.push({
            id: d.id,
            title: d.title,
            kind: d.kind,
            qty: i.qty,
            price: d.price,
          });
        }
        const total = items.reduce((s, i) => s + i.qty * i.price, 0);
        const { rows: order } = await c.query(
          "INSERT INTO sherbet.orders(request_id,client_id,customer,note,items,total,paid,order_day) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
          [
            b.requestId,
            clientId,
            b.name.trim(),
            String(b.note || "").slice(0, 300),
            JSON.stringify(items),
            total,
            b.paid === true,
            rules.clock().day,
          ],
        );
        await c.query("COMMIT");
        const r = json({ ok: true, id: order[0].id });
        r.cookies.set("sherbet_client", clientId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 31536000,
        });
        return r;
      } catch (e) {
        await c.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        c.release();
      }
    }
    if (route.startsWith("orders/") && method === "DELETE") {
      const id = Number(route.split("/")[1]);
      if (!Number.isInteger(id) || id < 1)
        return json({ error: "Некорректный заказ." }, 400);
      const r = await pool().query("DELETE FROM sherbet.orders WHERE id=$1", [
        id,
      ]);
      return json({ ok: true, deleted: r.rowCount });
    }
    if (route === "archive" && method === "GET") {
      const { rows } = await pool().query(
        "SELECT order_day::text AS day,count(*)::int AS count,sum(total)::int AS total FROM sherbet.orders GROUP BY order_day ORDER BY order_day DESC LIMIT 60",
      );
      return json({ days: rows });
    }
    if (route === "archive" && method === "POST") {
      await pool().query(
        "UPDATE sherbet.orders SET archived=true WHERE order_day<=$1",
        [rules.clock().day],
      );
      return json({ ok: true });
    }
    return json({ error: "Не найдено." }, 404);
  } catch (e) {
    const code = String(e.code || "");
    console.error(
      "Sherbet API:",
      route,
      /^[A-Z0-9_]+$/.test(code) ? code : "FAILED",
    );
    return json(
      {
        error: !process.env.DATABASE_URL
          ? "Подключите базу данных, чтобы принимать заказы."
          : "Не удалось выполнить запрос. Попробуйте ещё раз.",
        code: !process.env.DATABASE_URL
          ? "DATABASE_URL_MISSING"
          : /^[A-Z0-9_]+$/.test(code)
            ? code
            : "DATABASE_ERROR",
      },
      503,
    );
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
