// Configuração dos testes E2E (Playwright). Sobe o site com os dados FICTÍCIOS de tests/fixtures.
// Só Chromium. Em CI há 1 nova tentativa por teste e o servidor local não é reaproveitado.
import { defineConfig, devices } from "@playwright/test";

const URL_TESTE = "http://localhost:4173";

export default defineConfig({
  testDir: "tests/e2e",
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: URL_TESTE,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node scripts/serve.mjs --port 4173 --data-dir tests/fixtures",
    url: URL_TESTE,
    reuseExistingServer: !process.env.CI,
  },
});
