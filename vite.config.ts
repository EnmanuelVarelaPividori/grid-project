import {defineConfig} from "vite-plus";

export default defineConfig({
	defaultPackage: "./apps/landing",
	fmt: {
		ignorePatterns: [
			"**/dist/**",
			"**/node_modules/**",
			"**/routeTree.gen.ts",
			"skills/**",
			"apps/web/hero-ui/src/components/ui/**",
			"apps/web/hero-ui/src/hooks/**",
			"engines/**",
			"apps/web/static/**",
			"apps/web/docs/**",
			"apps/web/data/**",
			".claude/**",
			"pnpm-lock.yaml",
		],
		sortImports: {newlinesBetween: false},
		overrides: [
			{files: ["apps/landing/**"], options: {sortTailwindcss: {stylesheet: "apps/landing/src/styles/globals.css"}}},
			{files: ["apps/web/hero-ui/**"], options: {sortTailwindcss: {stylesheet: "apps/web/hero-ui/src/theme.css"}}},
		],
		sortPackageJson: true,
		useTabs: true,
		printWidth: 120,
		bracketSameLine: true,
		bracketSpacing: false,
	},
	lint: {
		ignorePatterns: [
			"**/dist/**",
			"**/node_modules/**",
			"**/routeTree.gen.ts",
			"skills/**",
			"apps/web/hero-ui/src/components/ui/**",
			"apps/web/hero-ui/src/hooks/**",
			"engines/**",
			"apps/web/static/**",
			"apps/web/docs/**",
			".claude/**",
		],
		categories: {correctness: "error", perf: "error"},
		options: {typeAware: true, typeCheck: true},
		plugins: ["react"],
		jsPlugins: [
			{name: "react-js", specifier: "eslint-plugin-react"},
			{name: "tailwindcss", specifier: "oxlint-tailwindcss"},
		],
		settings: {tailwindcss: {entryPoint: "apps/landing/src/styles/globals.css"}},

		rules: {
			"no-unused-vars": ["error", {fix: {imports: "safe-fix", variables: "suggestion"}}],

			"react-js/jsx-sort-props": [
				"error",
				{
					callbacksLast: true,
					ignoreCase: true,
					multiline: "last",
					noSortAlphabetically: false,
					reservedFirst: true,
					shorthandFirst: true,
				},
			],

			// oxlint-tailwindcss linting rules
			// Correctness
			"tailwindcss/no-unknown-classes": "off",
			"tailwindcss/no-duplicate-classes": "error",
			"tailwindcss/no-conflicting-classes": "error",
			"tailwindcss/no-deprecated-classes": "error",
			"tailwindcss/no-unnecessary-whitespace": "error",
			"tailwindcss/no-dark-without-light": "warn",
			"tailwindcss/no-contradicting-variants": "warn",
			// Style
			"tailwindcss/enforce-canonical": "warn",
			"tailwindcss/enforce-sort-order": "error",
			"tailwindcss/enforce-shorthand": "warn",
			"tailwindcss/enforce-logical": "off",
			"tailwindcss/enforce-physical": "off",
			"tailwindcss/enforce-consistent-important-position": "warn",
			"tailwindcss/enforce-negative-arbitrary-values": "warn",
			"tailwindcss/enforce-consistent-variable-syntax": "warn",
			"tailwindcss/consistent-variant-order": "warn",
			// Complexity
			"tailwindcss/max-class-count": "off",
			"tailwindcss/enforce-consistent-line-wrapping": "off",
			// Restrictions
			"tailwindcss/no-restricted-classes": "off",
			"tailwindcss/no-arbitrary-value": "off",
			"tailwindcss/no-hardcoded-colors": "warn",
			"tailwindcss/no-unnecessary-arbitrary-value": "warn",
			"tailwindcss/prefer-theme-tokens": "off",
		},
	},
	staged: {},
	test: {projects: ["apps/landing", "apps/web/hero-ui"]},
});
