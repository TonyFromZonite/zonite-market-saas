// Public image proxy for product images stored in the private "kyc-documents" bucket.
// KYC files (path starting with "kyc/") are explicitly refused.
import { createClient } from "npm:@supabase/supabase-js@2";

const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  webp: "image/webp", avif: "image/avif", gif: "image/gif", svg: "image/svg+xml",
};

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    let path = url.searchParams.get("path") || "";
    path = decodeURIComponent(path).replace(/^\/+/, "");

    if (!path || path.includes("..") || path.startsWith("kyc/")) {
      return new Response("Forbidden", { status: 403 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.storage.from("kyc-documents").download(path);
    if (error || !data) return new Response("Not found", { status: 404 });

    const ext = path.split(".").pop()?.toLowerCase() || "";
    const contentType = MIME[ext] || data.type || "application/octet-stream";

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response("Server error: " + (e as Error).message, { status: 500 });
  }
});
