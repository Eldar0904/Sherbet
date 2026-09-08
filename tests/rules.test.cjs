const { test } = require("node:test");
const assert = require("node:assert/strict");
const { clock, isClosed, validateOrder } = require("../lib/rules.cjs");
test("business day rolls over at Kazakhstan midnight", () => {
  assert.equal(clock(new Date("2026-09-08T19:00:00Z")).day, "2026-09-09");
  assert.equal(clock(new Date("2026-09-08T18:59:59Z")).day, "2026-09-08");
});
test("independent category deadlines and admin override", () => {
  const s = {
    mainClose: 780,
    bakeClose: 780,
    forceOpen: false,
    menuUpdatedDay: "2026-09-08",
  };
  const n = new Date("2026-09-08T05:30:00Z");
  assert.equal(isClosed("main", s, n), false);
  assert.equal(isClosed("bake", s, n), false);
  assert.equal(isClosed("main", s, new Date("2026-09-08T08:00:00Z")), true);
  assert.equal(isClosed("bake", { ...s, forceOpen: true }, n), false);
});
test("stale menus stay closed until the menu is updated today", () => {
  const s = {
    mainClose: 780,
    bakeClose: 780,
    forceOpen: false,
    menuUpdatedDay: "2026-09-07",
  };
  assert.equal(isClosed("main", s, new Date("2026-09-08T05:30:00Z")), true);
});
test("rejects malformed and duplicate quantities", () => {
  const b = {
    name: "Test",
    requestId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
    items: [{ id: 1, qty: 2 }],
  };
  assert.doesNotThrow(() => validateOrder(b));
  assert.throws(() => validateOrder({ ...b, name: "" }));
  assert.throws(() => validateOrder({ ...b, items: [{ id: 1, qty: -1 }] }));
  assert.throws(() =>
    validateOrder({
      ...b,
      items: [
        { id: 1, qty: 1 },
        { id: 1, qty: 2 },
      ],
    }),
  );
  assert.throws(() => validateOrder({ ...b, requestId: "bad" }));
});
