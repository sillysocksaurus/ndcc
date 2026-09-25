import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import react from "eslint-plugin-react";

export default [
  { ignores: ["dist"] },
  { files: ["api/**/*.js", "vite.config.js"], languageOptions: { globals: globals.node } },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser, parserOptions: { ecmaVersion: "latest", ecmaFeatures: { jsx: true }, sourceType: "module" } },
    plugins: { react, "react-hooks": reactHooks, "react-refresh": reactRefresh },
    settings: { react: { version: "18.3" } },
    rules: { ...js.configs.recommended.rules, "react/jsx-uses-vars": "error", "react/jsx-uses-react": "error", ...reactHooks.configs.recommended.rules, "react-refresh/only-export-components": "off", "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^_" }] },
  },
];
