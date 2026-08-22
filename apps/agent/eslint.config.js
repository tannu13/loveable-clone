import { config } from "@repo/eslint-config/node";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    // Anchor type-aware linting to this app's tsconfig, so the rules work the
    // same whether ESLint is launched by the IDE, by `bun run lint`, or by turbo.
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
];
