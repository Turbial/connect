import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
  },
});
