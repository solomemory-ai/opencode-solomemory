import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  // Base
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Plugins
  sonarjs.configs.recommended,
  unicorn.configs["flat/recommended"],

  // Prettier (must be last preset — disables conflicting format rules)
  eslintConfigPrettier,

  // Global parser options
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Project rules
  {
    files: ["src/**/*.ts"],
    rules: {
      // ── Complexity ──────────────────────────────────────────────
      complexity: ["warn", 15],
      "max-depth": ["warn", 4],
      "max-lines": ["warn", { max: 600, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", { max: 80, skipBlankLines: true, skipComments: true }],
      "max-params": ["warn", 4],
      "max-nested-callbacks": ["warn", 3],

      // ── SonarJS ─────────────────────────────────────────────────
      "sonarjs/cognitive-complexity": ["warn", 15],

      // ── TypeScript strict ───────────────────────────────────────
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",

      // ── Unicorn overrides (opinionated defaults we relax) ──────
      "unicorn/prevent-abbreviations": "off",
      "unicorn/no-null": "off",
      "unicorn/no-process-exit": "off",
      "unicorn/prefer-top-level-await": "off",
    },
  },

  // Ignores
  {
    ignores: ["dist/**", "node_modules/**", "*.config.*", "scripts/**"],
  },
);
