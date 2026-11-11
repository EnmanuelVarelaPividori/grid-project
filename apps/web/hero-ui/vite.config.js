import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {defineConfig} from "vite-plus";

export default defineConfig(({command}) => ({
	plugins: [react(), tailwindcss()],
	resolve: {alias: {"@": path.resolve(import.meta.dirname, "src")}},
	base: command === "build" ? "/static/heroui/" : "/",
	build: {outDir: "../static/heroui", emptyOutDir: true},
	server: {port: 5175, strictPort: true, proxy: {"/api": "http://127.0.0.1:8765"}},
}));
