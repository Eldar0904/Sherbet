import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";
const globalDB = globalThis;
export function pool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_MISSING");
  if (!globalDB.sherbetPool) {
    globalDB.sherbetPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 5000,
      statement_timeout: 45000,
    });
    if (process.env.VERCEL) attachDatabasePool(globalDB.sherbetPool);
    globalDB.sherbetPool.on("error", () =>
      console.error("Sherbet database connection closed"),
    );
  }
  return globalDB.sherbetPool;
}
const schema = `CREATE SCHEMA IF NOT EXISTS sherbet;
CREATE TABLE IF NOT EXISTS sherbet.dishes(id SERIAL PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',kind TEXT NOT NULL CHECK(kind IN ('main','bake')),price INTEGER NOT NULL CHECK(price>=0 AND price<=100000),active BOOLEAN NOT NULL DEFAULT false,art TEXT NOT NULL DEFAULT 'bowl');
CREATE TABLE IF NOT EXISTS sherbet.settings(id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id=1),force_open BOOLEAN NOT NULL DEFAULT false,main_close INTEGER NOT NULL DEFAULT 720,bake_close INTEGER NOT NULL DEFAULT 720,menu_updated_day DATE);
ALTER TABLE sherbet.settings ALTER COLUMN main_close SET DEFAULT 720;
ALTER TABLE sherbet.settings ALTER COLUMN bake_close SET DEFAULT 720;
ALTER TABLE sherbet.settings ADD COLUMN IF NOT EXISTS menu_updated_day DATE;
INSERT INTO sherbet.settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS sherbet.orders(id SERIAL PRIMARY KEY,request_id UUID NOT NULL UNIQUE,client_id UUID NOT NULL,customer TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',items JSONB NOT NULL,total INTEGER NOT NULL,paid BOOLEAN NOT NULL DEFAULT false,order_day DATE NOT NULL,archived BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS sherbet_orders_day ON sherbet.orders(order_day);
ALTER TABLE sherbet.dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sherbet.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sherbet.orders ENABLE ROW LEVEL SECURITY;`;
export async function ready() {
  if (!globalDB.sherbetReady)
    globalDB.sherbetReady = (async () => {
      const c = await pool().connect();
      try {
        await c.query("BEGIN");
        await c.query("SELECT pg_advisory_xact_lock(880310)");
        await c.query(schema);
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        c.release();
      }
    })().catch((e) => {
      globalDB.sherbetReady = null;
      throw e;
    });
  await globalDB.sherbetReady;
}
export async function settings(client = pool()) {
  const { rows } = await client.query(
    "SELECT * FROM sherbet.settings WHERE id=1",
  );
  return {
    forceOpen: rows[0].force_open,
    mainClose: rows[0].main_close,
    bakeClose: rows[0].bake_close,
    menuUpdatedDay:
      rows[0].menu_updated_day?.toISOString?.().slice(0, 10) ||
      rows[0].menu_updated_day,
  };
}
