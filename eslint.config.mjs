import next from "eslint-config-next/core-web-vitals";

const config = [
  ...next,
  {
    ignores: [".next/*", "coverage/*", "node_modules/*", "ia/**", ".opencode/**", ".husky/**"],
  },
  {
    rules: {
      complexity: ["error", 10],
      "max-lines-per-function": ["error", 50],
      "max-depth": ["error", 3],
      "no-console": "error",
      eqeqeq: "error",
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];

export default config;
