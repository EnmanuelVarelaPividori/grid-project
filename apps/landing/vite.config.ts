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
	ssr: {noExternal: ["@gravity-ui/icons"]},
	plugins: [
		process.env.VITE_DEVTOOLS === "true" && devtools(),
		tanstackStart(),
		react({compiler: true}),
		tailwindcss(),
	],
});
