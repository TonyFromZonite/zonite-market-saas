/**
 * AUDIT 15 — PWA (2 tests)
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

describe("Audit 15 — PWA", () => {
  it("15.1 manifest.json existe et contient les champs requis", () => {
    const manifestPath = resolve(__dirname, "../../public/manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name || manifest.name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
  });

  it("15.2 index.html référence le manifest", () => {
    const htmlPath = resolve(__dirname, "../../index.html");
    const html = readFileSync(htmlPath, "utf-8");
    expect(html).toContain("manifest.json");
  });
});
