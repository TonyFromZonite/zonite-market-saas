/**
 * AUDIT 17 — Build final (5 tests)
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

describe("Audit 17 — Build final", () => {
  it("17.1 package.json existe et a les scripts nécessaires", () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf-8"));
    expect(pkg.scripts.build).toBeTruthy();
    expect(pkg.scripts.dev).toBeTruthy();
  });

  it("17.2 vite.config.ts existe", () => {
    expect(existsSync(resolve(__dirname, "../../vite.config.ts"))).toBe(true);
  });

  it("17.3 tailwind.config.ts existe", () => {
    expect(existsSync(resolve(__dirname, "../../tailwind.config.ts"))).toBe(true);
  });

  it("17.4 index.html a les meta tags essentiels", () => {
    const html = readFileSync(resolve(__dirname, "../../index.html"), "utf-8");
    expect(html).toContain("<meta");
    expect(html).toContain("viewport");
    expect(html).toContain("<title>");
  });

  it("17.5 Fichiers critiques de l'app existent", () => {
    const files = [
      "src/App.jsx",
      "src/main.jsx",
      "src/lib/AuthContext.jsx",
      "src/components/useSessionGuard.jsx",
      "src/components/BiometricLock.jsx",
      "src/components/AppLockScreen.jsx",
      "src/components/NotificationManager.jsx",
      "src/lib/notificationSystem.js",
    ];
    files.forEach(f => expect(existsSync(resolve(__dirname, `../../${f}`))).toBe(true));
  });
});
