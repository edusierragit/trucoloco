import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default [
  { ignores: ["dist/", "node_modules/", "public/"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node }
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // solo las reglas clásicas: las del compilador (immutability, refs) marcan
      // como error el patrón idiomático de R3F (mutar camera/refs en useFrame)
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // JSX usa los componentes: sin plugin de react, marcarlos unused es ruido
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^_" }]
    }
  },
  prettier
];
