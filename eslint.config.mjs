import node from "eslint-plugin-node";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      node,
    },
    rules: {
      // Disallow direct access to `process.env`. All environment variables should
      // go through the validated env object exported on startup.
      "node/no-process-env": "error",
    },
  },
  {
    files: ["**/*.{js,ts,mjs,cjs}"],
    rules: {
      "@typescript-eslint/indent": "on",
      "@typescript-eslint/comma-dangle": "on",
    },
  },
);
