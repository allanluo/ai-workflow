import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "vmForks",
    poolOptions: {
      vmForks: {
        singleFork: true
      }
    },
    env: {
      NODE_ENV: "test",
      DATABASE_URL: ":memory:"
    },
    setupFiles: [],
    globals: true,
    thread: false
  }
});
