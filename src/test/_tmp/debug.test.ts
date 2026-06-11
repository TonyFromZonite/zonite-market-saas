import { describe, it, expect } from "vitest";
import { inspectHeicBrand } from "@/lib/imageProcessor";

describe("debug", () => {
  it("inspects brand", async () => {
    const enc = new TextEncoder();
    const ftyp = enc.encode("ftyp");
    const brandBytes = enc.encode("hevc");
    const version = new Uint8Array([0,0,0,0]);
    const compatible = enc.encode("mif1heic");
    const buf = new Uint8Array(4 + 4 + 4 + 4 + 8);
    let o=4;
    buf.set(ftyp,o); o+=4; buf.set(brandBytes,o); o+=4; buf.set(version,o); o+=4; buf.set(compatible,o);
    const file = new File([buf], "x.heic", { type: "image/heic" });
    const info = await inspectHeicBrand(file);
    console.log("INFO:", JSON.stringify(info));
    expect(info).toBeDefined();
  });
});
