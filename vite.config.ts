import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import {devtools} from "@tanstack/devtools-vite";
import {tanstackStart} from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import {defineConfig} from "vite-plus";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	run: {
		tasks: {
			dev: "vp dev",
			build: "vp build",
			preview: "vp preview",
			format: "vp fmt",
			lint: "vp lint",
			"lint:fix": "vp lint --fix",
			check: "vp check",
			"check:fix": "vp check --fix",
		},
	},
	plugins: [devtools(), tanstackStart(), react({compiler: true}), tailwindcss()],
	fmt: {
		ignorePatterns: ["dist/**", "node_modules/**", "routeTree.gen.ts", "skills/**"],
		sortImports: {newlinesBetween: false},
		sortTailwindcss: {stylesheet: "src/styles/globals.css"},
		sortPackageJson: true,
		useTabs: true,
		printWidth: 120,
		bracketSameLine: true,
		bracketSpacing: false,
	},
	lint: {
		ignorePatterns: ["dist/**", "node_modules/**", "routeTree.gen.ts"],
		categories: {correctness: "error", perf: "error"},
		options: {typeAware: true, typeCheck: true},
		plugins: ["react"],
		jsPlugins: [
			{name: "react-js", specifier: "eslint-plugin-react"},
			{name: "tailwindcss", specifier: "oxlint-tailwindcss"},
		],
		settings: {tailwindcss: {entryPoint: "src/styles/globals.css"}},

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
	ssr: {noExternal: ["@gravity-ui/icons"]},
});
