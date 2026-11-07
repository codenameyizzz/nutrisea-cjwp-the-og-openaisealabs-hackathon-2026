// Register an async loader so tsx and CommonJS dependencies can supply their own source.
import { register } from "node:module";
register("./css-loader.mjs", import.meta.url);

// tsx compiles this package's TSX tests to CommonJS; mirror the CSS stub for require().
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require.extensions[".css"] = module => {
  module.exports = new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) });
};
