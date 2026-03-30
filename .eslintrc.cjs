module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  rules: {
    "no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }
    ]
  },
  overrides: [
    {
      files: ["api/**/*.js", "tests/**/*.cjs"],
      parserOptions: {
        sourceType: "script"
      }
    }
  ]
};
