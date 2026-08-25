// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintPluginPrettier from 'eslint-plugin-prettier'
import eslintConfigPrettier from 'eslint-config-prettier'

/**
 * The lint rules every package in the monorepo shares.
 *
 * Type-aware linting only works when the parser can find the tsconfig that
 * owns the file, which is per-package, so each package passes its own
 * directory: `createConfig(import.meta.dirname)`. Everything a package needs
 * on top of that — its `ignores`, a rule it deliberately turns off — goes in
 * plain flat-config objects after the spread:
 *
 *   export default [
 *     ...createConfig(import.meta.dirname),
 *     { ignores: ['dist/**'] },
 *   ]
 *
 * @param {string} tsconfigRootDir absolute path to the package root
 * @param {{ strict?: boolean }} [options] `strict` opts the package into
 *   typescript-eslint's `strictTypeChecked` on top of the shared rules.
 */
export function createConfig(tsconfigRootDir, options = {}) {
  return tseslint.config(
    eslint.configs.recommended,
    ...(options.strict
      ? tseslint.configs.strictTypeChecked
      : tseslint.configs.recommendedTypeChecked),
    eslintConfigPrettier,
    {
      plugins: {
        prettier: eslintPluginPrettier,
      },
      rules: {
        'prettier/prettier': 'error',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_' },
        ],
        'no-console': 'warn',
      },
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
    },
    {
      // Config files and static browser scripts are not in any tsconfig.
      files: ['**/*.js', '**/*.mjs'],
      ...tseslint.configs.disableTypeChecked,
    },
    {
      // Test doubles are built by hand and asserted on loosely; the unsafe-*
      // rules would fire on every `vi.fn()` result. `unbound-method` fires on
      // every `expect(mock.someMethod)` — the whole point of which is to pass
      // the method around unbound — and has no vitest-aware variant.
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/unbound-method': 'off',
      },
    }
  )
}
