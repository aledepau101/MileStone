const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
    {
        ignores: ["node_modules/**", "out/**", "coverage/**"],
    },
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: {
                ...globals.browser,
                ...globals.node,
                plannerLogic: "readonly",
            },
        },
        rules: {
            ...js.configs.recommended.rules,
        },
    },
];