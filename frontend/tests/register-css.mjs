// CSS modules have no DOM behavior in unit tests; production uses Next's loader.
import { registerHooks } from "node:module";
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".module.css")) {
      return { format: "module", shortCircuit: true, source: 'export default new Proxy({}, { get: (_, key) => String(key) });' };
    }
    return nextLoad(url, context);
  },
});
