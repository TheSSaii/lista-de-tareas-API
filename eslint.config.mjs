import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/*", "coverage/*", "ia/logs/*"] },
  {
    rules: {
      complexity: ["error", 10],
      "max-lines-per-function": ["error", 50],
      "max-depth": ["error", 3],
      "no-console": "error",
      eqeqeq: "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];