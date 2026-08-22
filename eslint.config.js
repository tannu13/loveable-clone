import { config } from "./packages/eslint-config/node.js";

export default [
  ...config,
  {
    ignores: ["apps/**", "packages/**", "dist/**", "node_modules/**"],
  },
];
