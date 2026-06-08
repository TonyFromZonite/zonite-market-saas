import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Extrait le chemin objet depuis une URL stockée (publique ou signée) et
 * génère une URL signée à la volée. Le bucket kyc-documents étant désormais
 * privé, c'est le seul moyen d'afficher les pièces côté admin/vendeur.
 */
export async function signKycUrl(url, expiresIn = 3600) {
  if (!url || typeof url !== "string") return null;
  const marker = "/kyc-documents/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  let path = url.slice(idx + marker.length);
  // strip query string & leading slashes
  path = path.split("?")[0].replace(/^\/+/, "");
  if (!path) return null;
  try {
    const { data, error } = await supabase
      .storage
      .from("kyc-documents")
      .createSignedUrl(path, expiresIn);
    if (error) return null;
    return data?.signedUrl || null;
  } catch (_) {
    return null;
  }
}

export default function KycImage({ url, alt, className = "" }) {
  const [signed, setSigned] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    signKycUrl(url).then((s) => {
      if (!cancelled) {
        setSigned(s);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [url]);

  if (!url) return null;

  if (loading) {
    return <div className={`${className} bg-slate-100 animate-pulse rounded-lg`} />;
  }

  if (!signed) {
    return (
      <div className={`${className} bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400`}>
        Indisponible
      </div>
    );
  }

  return (
    <img
      src={signed}
      alt={alt}
      className={className}
      onClick={() => window.open(signed, "_blank")}
    />
  );
}
