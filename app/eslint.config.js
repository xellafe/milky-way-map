import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      // Tailwind's scanner cannot read a class glued to ${…}, so its rule is never generated (#27).
      'no-restricted-syntax': [
        'error',
        ...['[tail=false][value.raw=/\\S$/]', ':not(:first-child)[value.raw=/^\\S/]'].map(
          (suffix) => ({
            selector: `JSXAttribute[name.name="className"] TemplateLiteral > TemplateElement${suffix}`,
            message:
              'Separate Tailwind classes from ${…} with a space: the scanner cannot read them glued together (#27).',
          }),
        ),
      ],
    },
  },
]);
