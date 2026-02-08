import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  // Base
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Plugins
  sonarjs.configs.recommended,
  unicorn.configs["flat/recommended"],

  // Prettier (must be last preset — disables conflicting rules + reports formatting as errors)
  eslintPluginPrettier,

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
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      // ── Complexity ──────────────────────────────────────────────
      complexity: ["error", 10],
      "max-depth": ["error", 3],
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
      "max-params": ["error", 3],
      "max-nested-callbacks": ["error", 3],
      "max-statements": ["error", 15],
      "no-else-return": ["error", { allowElseIf: false }],

      // ── SonarJS ─────────────────────────────────────────────────
      "sonarjs/cognitive-complexity": ["error", 10],

      // ── TypeScript strict ───────────────────────────────────────
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowConciseArrowFunctionExpressionsStartingWithVoid: true,
        },
      ],
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowString: true,
          allowNumber: false,
          allowNullableObject: true,
          allowNullableBoolean: false,
          allowNullableString: true,
        },
      ],
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "@typescript-eslint/no-confusing-void-expression": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/no-magic-numbers": [
        "error",
        {
          ignore: [-1, 0, 1, 2],
          ignoreEnums: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
        },
      ],
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["camelCase"], leadingUnderscore: "allow" },
        { selector: "variable", format: ["camelCase", "UPPER_CASE"], leadingUnderscore: "allow" },
        {
          selector: "variable",
          modifiers: ["const", "exported"],
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
        },
        { selector: "function", format: ["camelCase"] },
        { selector: "parameter", format: ["camelCase"], leadingUnderscore: "allow" },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["PascalCase", "UPPER_CASE"] },
        { selector: "property", format: null },
        { selector: "import", format: null },
      ],

      // ── Import organization ─────────────────────────────────────
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

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
