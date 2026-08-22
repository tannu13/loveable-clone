import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import globals from "globals";
// import onlyWarn from "eslint-plugin-only-warn";

/**
 * Type-aware ESLint configuration for the Node/Bun services in this repo.
 *
 * Two things make this different from `base`:
 *
 * 1. It connects ESLint to the TypeScript program (`projectService`). The
 *    promise-safety rules below need to know whether an expression *is* a
 *    Promise, and that is type information, not syntax — they are impossible
 *    without it.
 * 2. It deliberately omits `eslint-plugin-only-warn`, so these surface as real
 *    errors in the editor rather than yellow squiggles.
 *
 * Consuming apps should append a block setting `tsconfigRootDir` to their own
 * directory so the right tsconfig is picked up regardless of where ESLint runs.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: { turbo: turboPlugin },
    // plugins: { turbo: turboPlugin, "only-warn": onlyWarn },
    rules: { "turbo/no-undeclared-env-vars": "warn" },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { projectService: true },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      // Cheap neighbours that catch the same class of mistake.
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],

      // Errors thrown or rejected must be real Errors, or the stack trace is
      // lost — painful in a queue consumer where that trace is all you get.
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/prefer-promise-reject-errors": "error",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",

      // Provably dead casts: they hide drift when the underlying types change.
      "@typescript-eslint/no-unnecessary-type-assertion": "error",

      // `verbatimModuleSyntax` is on, so a missing `type` keyword turns into a
      // real runtime import. This rule and that compiler flag are a pair.
      "@typescript-eslint/consistent-type-imports": "error",

      "eqeqeq": "error",
      "prefer-const": "error",

      // Warnings, not errors: both are routine mid-edit states and should not
      // light up the editor while you are still typing.
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "eslint.config.js"],
  },
];
