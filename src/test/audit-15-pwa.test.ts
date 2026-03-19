/**
 * AUDIT 15 — PWA branding (7 tests)
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

describe("Audit 15 — PWA branding", () => {
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

  it("15.3 favicon.ico existe", () => {
    expect(existsSync(resolve(__dirname, "../../public/favicon.ico"))).toBe(true);
  });

  it("15.4 apple-touch-icon existe", () => {
    expect(existsSync(resolve(__dirname, "../../public/apple-touch-icon.png"))).toBe(true);
  });

  it("15.5 logo192 et logo512 existent", () => {
    expect(existsSync(resolve(__dirname, "../../public/logo192.png"))).toBe(true);
    expect(existsSync(resolve(__dirname, "../../public/logo512.png"))).toBe(true);
  });

  it("15.6 manifest a display standalone", () => {
    const manifest = JSON.parse(readFileSync(resolve(__dirname, "../../public/manifest.json"), "utf-8"));
    expect(manifest.display).toBe("standalone");
  });

  it("15.7 robots.txt existe", () => {
    expect(existsSync(resolve(__dirname, "../../public/robots.txt"))).toBe(true);
  });
});
