import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/dashboard": "http://localhost:3000",
      "/jobs": "http://localhost:3000"
    }
  }
});
