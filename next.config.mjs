import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL(".", import.meta.url));
export default {
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  turbopack: { root },
  outputFileTracingRoot: root,
};
