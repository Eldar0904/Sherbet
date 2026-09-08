const ZONE = "Asia/Qyzylorda";
function clock(now = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}
function isClosed(kind, settings, now) {
  const c = clock(now);
  return (
    !settings.forceOpen &&
    (settings.menuUpdatedDay !== c.day ||
      c.minutes >=
        Number(kind === "bake" ? settings.bakeClose : settings.mainClose))
  );
}
function validateOrder(body) {
  if (
    typeof body.name !== "string" ||
    !body.name.trim() ||
    body.name.length > 100
  )
    throw new Error("Укажите имя (до 100 символов).");
  if (
    !Array.isArray(body.items) ||
    !body.items.length ||
    body.items.length > 30
  )
    throw new Error("Добавьте блюдо в заказ.");
  if (
    body.items.some(
      (i) =>
        !i ||
        !Number.isInteger(i.id) ||
        !Number.isInteger(i.qty) ||
        i.qty < 1 ||
        i.qty > 30,
    )
  )
    throw new Error("Проверьте количество блюд.");
  if (new Set(body.items.map((i) => i.id)).size !== body.items.length)
    throw new Error("Блюдо повторяется в заказе.");
  if (
    typeof body.requestId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(body.requestId)
  )
    throw new Error("Обновите страницу и повторите заказ.");
}
module.exports = { clock, isClosed, validateOrder };
