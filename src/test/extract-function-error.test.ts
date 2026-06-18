import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractFunctionError } from "@/lib/extractFunctionError";

// Helper to build a fake supabase functions error
function buildError(status: number, body: string, contentType = "application/json") {
  const response = new Response(body, {
    status,
    headers: { "Content-Type": contentType },
  });
  return {
    name: "FunctionsHttpError",
    message: "Edge Function returned a non-2xx status code",
    context: response,
  };
}

describe("extractFunctionError — couvre les scénarios non-2xx du flux inscription", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("1) doublon email (409) : renvoie le message serveur, pas le message générique", async () => {
    const err = buildError(
      409,
      JSON.stringify({ error: "Cet email a déjà un compte. Connectez-vous.", field: "email" })
    );
    const result = await extractFunctionError(err);
    expect(result.status).toBe(409);
    expect(result.message).toBe("Cet email a déjà un compte. Connectez-vous.");
    expect(result.payload.field).toBe("email");
    expect(result.message).not.toMatch(/non-2xx/i);
  });

  it("2) throttle Auth (429) : expose retry_after pour activer le cooldown UI", async () => {
    const err = buildError(
      429,
      JSON.stringify({
        error: "Trop de tentatives. Patientez 45s.",
        retry_after: 45,
        throttled: true,
      })
    );
    const result = await extractFunctionError(err);
    expect(result.status).toBe(429);
    expect(result.payload.throttled).toBe(true);
    expect(result.payload.retry_after).toBe(45);
    expect(result.message).toContain("45");
  });

  it("3) email Resend KO (502) : message serveur conservé", async () => {
    const err = buildError(
      502,
      JSON.stringify({ error: "Impossible d'envoyer le code de vérification. Réessayez." })
    );
    const result = await extractFunctionError(err);
    expect(result.status).toBe(502);
    expect(result.message).toMatch(/code de vérification/i);
  });

  it("4) body non-JSON (502 HTML) : retombe sur fallback métier, jamais sur le générique", async () => {
    const err = buildError(502, "<html><body>Bad Gateway</body></html>", "text/html");
    const result = await extractFunctionError(
      err,
      "Une erreur est survenue lors de l'inscription. Réessayez dans un instant."
    );
    expect(result.status).toBe(502);
    expect(result.message).not.toMatch(/non-2xx/i);
    // Soit le texte brut, soit le fallback — jamais le message générique
    expect(
      result.message === "<html><body>Bad Gateway</body></html>" ||
        result.message.startsWith("Une erreur est survenue")
    ).toBe(true);
  });

  it("5) body vide (500) : fallback explicite", async () => {
    const err = buildError(500, "");
    const result = await extractFunctionError(err, "Une erreur est survenue lors de l'inscription.");
    expect(result.status).toBe(500);
    expect(result.message).toBe("Une erreur est survenue lors de l'inscription.");
  });

  it("6) error sans context (réseau coupé) : fallback explicite", async () => {
    const err = { message: "Edge Function returned a non-2xx status code" } as any;
    const result = await extractFunctionError(err, "Erreur réseau, réessayez.");
    expect(result.message).toBe("Erreur réseau, réessayez.");
    expect(result.payload).toEqual({});
  });

  it("7) username déjà pris (409) : field propagé pour ciblage UI", async () => {
    const err = buildError(
      409,
      JSON.stringify({ error: "Ce nom d'utilisateur est déjà pris", field: "username" })
    );
    const result = await extractFunctionError(err);
    expect(result.payload.field).toBe("username");
    expect(result.message).toMatch(/déjà pris/i);
  });
});
