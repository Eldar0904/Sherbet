import { createHmac, timingSafeEqual } from "node:crypto";
export function same(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function sign(value) {
  return createHmac(
    "sha256",
    process.env.SESSION_SECRET || process.env.ADMIN_PIN || "disabled",
  )
    .update(value)
    .digest("hex");
}
export function token() {
  const expiry = String(Date.now() + 8 * 3600000);
  return expiry + "." + sign(expiry);
}
export function admin(request) {
  if (!process.env.ADMIN_PIN) return false;
  const value = request.cookies.get("sherbet_admin")?.value || "";
  const [expiry, sig] = value.split(".");
  return Number(expiry) > Date.now() && same(sig, sign(expiry));
}
