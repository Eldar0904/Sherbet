const { test } = require("node:test");
const assert = require("node:assert/strict");
const { clock } = require("../lib/rules.cjs");
process.env.DATABASE_URL = "postgresql://unused:unused@localhost/unused";
process.env.ADMIN_PIN = "test-password";
process.env.SESSION_SECRET = "test-session-key";
process.env.CRON_SECRET = "test-cron-key";
let calls = [],
  forceOpen = true;
const dishes = [
  { id: 1, title: "Lunch", kind: "main", price: 1250, active: true },
  { id: 2, title: "Hidden", kind: "bake", price: 700, active: false },
];
const client = {
  async query(sql, values) {
    calls.push({ sql, values });
    if (sql.includes("SELECT * FROM sherbet.settings"))
      return {
        rows: [{ force_open: forceOpen, main_close: 0, bake_close: 0 }],
      };
    if (sql.includes("SELECT * FROM sherbet.dishes")) return { rows: dishes };
    if (sql.startsWith("INSERT INTO sherbet.orders"))
      return { rows: [{ id: 5 }] };
    return { rows: [], rowCount: 2 };
  },
  release() {},
};
global.sherbetReady = Promise.resolve();
global.sherbetPool = { query: client.query, connect: async () => client };
const loaded = Promise.all([
  import("../app/api/[...path]/route.js"),
  import("next/server.js"),
  import("../lib/auth.js"),
]);
async function request(path, method = "GET", body, headers = {}) {
  const [route, { NextRequest }] = await loaded;
  const req = new NextRequest("http://localhost/api/" + path, {
    method,
    headers: {
      ...headers,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return route[method](req, {
    params: Promise.resolve({ path: path.split("/") }),
  });
}
const order = {
  name: "Test",
  requestId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  items: [{ id: 1, qty: 2, price: 1 }],
  paid: false,
};
test("menu hides inactive dishes and establishes private device cookie", async () => {
  const r = await request("menu");
  assert.equal(r.status, 200);
  assert.equal((await r.json()).dishes.length, 1);
  assert.match(r.headers.get("set-cookie"), /HttpOnly/i);
});
test("admin and cron deny unauthenticated access", async () => {
  assert.equal((await request("dishes", "POST", {})).status, 401);
  assert.equal((await request("cron/archive")).status, 401);
  assert.equal((await request("settings", "PUT", {})).status, 401);
  assert.equal((await request("orders/5", "DELETE")).status, 401);
});
test("admin session uses HttpOnly cookie and rejects wrong password", async () => {
  assert.equal(
    (await request("session", "POST", { pin: "wrong" })).status,
    401,
  );
  const r = await request("session", "POST", { pin: "test-password" });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(r.headers.get("set-cookie"), /SameSite=strict/i);
});
test("orders ignore client prices and persist catalog total", async () => {
  calls = [];
  const r = await request("orders", "POST", order);
  assert.equal(r.status, 200);
  const insert = calls.find((c) =>
    c.sql.startsWith("INSERT INTO sherbet.orders"),
  );
  assert.equal(insert.values[5], 2500);
  assert.equal(JSON.parse(insert.values[4])[0].price, 1250);
  assert.equal(calls.at(-1).sql, "COMMIT");
});
test("closed, inactive and missing dishes never create orders", async () => {
  forceOpen = false;
  assert.equal((await request("orders", "POST", order)).status, 409);
  forceOpen = true;
  for (const id of [2, 99]) {
    calls = [];
    assert.equal(
      (await request("orders", "POST", { ...order, items: [{ id, qty: 1 }] }))
        .status,
      409,
    );
    assert.ok(
      !calls.some((c) => c.sql.startsWith("INSERT INTO sherbet.orders")),
    );
  }
});
test("saving a dish publishes today's menu until the 1 pm close", async () => {
  const [, , auth] = await loaded;
  calls = [];
  const r = await request(
    "dishes",
    "POST",
    {
      title: "Fresh lunch",
      kind: "main",
      price: 1500,
      active: true,
      art: "bowl",
    },
    { cookie: "sherbet_admin=" + auth.token() },
  );
  assert.equal(r.status, 200);
  const publish = calls.find((c) =>
    c.sql.includes("UPDATE sherbet.settings SET menu_updated_day"),
  );
  assert.equal(publish.values[0], clock().day);
  assert.match(publish.sql, /main_close=780,bake_close=780/);
});
test("admin can delete an order", async () => {
  const [, , auth] = await loaded;
  calls = [];
  const r = await request("orders/5", "DELETE", null, {
    cookie: "sherbet_admin=" + auth.token(),
  });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, deleted: 2 });
  assert.equal(calls.at(-1).sql, "DELETE FROM sherbet.orders WHERE id=$1");
  assert.deepEqual(calls.at(-1).values, [5]);
});
test("cross-origin writes are rejected before processing", async () => {
  assert.equal(
    (
      await request("orders", "POST", order, {
        origin: "https://untrusted.example",
      })
    ).status,
    403,
  );
});
test("cron archives older dates without deleting orders", async () => {
  calls = [];
  const r = await request("cron/archive", "GET", null, {
    authorization: "Bearer test-cron-key",
  });
  assert.equal(r.status, 200);
  assert.match(calls[0].sql, /order_day<\$1 AND archived=false/);
  assert.ok(!calls.some((c) => c.sql.includes("DELETE")));
});
