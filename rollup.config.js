import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import replace from "@rollup/plugin-replace";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

export default {
  input: "src/arlo-camera-card.ts",
  output: {
    file: "dist/arlo-camera-card.js",
    format: "es",
    inlineDynamicImports: true,
    sourcemap: false,
  },
  plugins: [
    replace({
      preventAssignment: true,
      // Single source of truth: stamp the package.json version into the bundle.
      __CARD_VERSION__: pkg.version,
    }),
    resolve(),
    typescript({ tsconfig: "./tsconfig.json" }),
    terser(),
  ],
};
