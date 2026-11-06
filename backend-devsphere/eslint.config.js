import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**"] },
  {
    files: ["src/**/*.js", "tests/**/*.js", "scripts/**/*.js"],
    ...js.configs.recommended,
    languageOptions: { globals: globals.node },
  },
];
