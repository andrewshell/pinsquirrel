import { defineConfig } from "vite";
import devServer from "@hono/vite-dev-server";

export default defineConfig({
  server: {
    port: 8101,
  },
  plugins: [
    devServer({
      entry: "src/app.ts",
    }),
  ],
});
