import { createLovableConfig } from "lovable-agent-playwright-config/config";

export default createLovableConfig({
  testDir: "./e2e",
  // Lance le serveur Vite preview pour les tests CI ; en local, réutilise
  // le serveur déjà démarré si présent.
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
  },
});
