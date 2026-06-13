import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { createPageUrl } from "@/utils";
import { useToast } from "@/hooks/use-toast";
import { AlertOctagon, X, ExternalLink } from "lucide-react";

const CATEGORY_LABELS = {
  auth: "🔐 Auth",
  kyc: "📋 KYC",
  upload: "🖼️ Upload",
  sync: "🔄 Sync",
  systeme: "⚠️ Système",
};

const TARGET_PAGE = "JournalAudit"; // page admin du journal

function extractCategory(row) {
  // logCritical stocke {category, ...} dans details JSONB
  const d = row?.details;
  if (!d) return "systeme";
  if (typeof d === "object" && d.category) return d.category;
  return "systeme";
}

// Ignore les faux positifs : mauvais mot de passe utilisateur, permission navigateur refusée.
function isFalsePositive(row) {
  const err = row?.details?.error;
  if (!err) return false;
  if (err.code === "invalid_credentials") return true;
  if (err.name === "NotAllowedError") return true;
  if (typeof err.message === "string" && /not allowed by the user agent/i.test(err.message)) return true;
  return false;
}

/**
 * Bannière temps-réel pour les admins du /TableauDeBord.
 * - Souscrit aux inserts dans journal_audit où action commence par "[ALERT]"
 * - Affiche un toast destructif + une carte persistante avec compteur par catégorie
 * - Lien direct vers la liste filtrée (Journal d'Audit)
 */
export default function AlertesCritiquesAdmin() {
  const [alertes, setAlertes] = useState([]); // [{id, action, category, message, created_at}]
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();

  // Charger les alertes des dernières 24h au montage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("journal_audit")
        .select("id, action, details, created_at, utilisateur")
        .like("action", "[ALERT]%")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled || !data) return;
      setAlertes(
        data.map((r) => ({
          id: r.id,
          action: r.action.replace(/^\[ALERT\]\s*/, ""),
          category: extractCategory(r),
          message: r.details?.error?.message || r.utilisateur || r.action,
          created_at: r.created_at,
        }))
      );
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime — nouvelles alertes
  useEffect(() => {
    const channel = supabase
      .channel("admin-critical-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "journal_audit" },
        (payload) => {
          const row = payload?.new;
          if (!row || typeof row.action !== "string" || !row.action.startsWith("[ALERT]")) return;
          const entry = {
            id: row.id,
            action: row.action.replace(/^\[ALERT\]\s*/, ""),
            category: extractCategory(row),
            message: row.details?.error?.message || row.utilisateur || row.action,
            created_at: row.created_at,
          };
          setAlertes((prev) => [entry, ...prev].slice(0, 20));
          setDismissed(false);
          toast({
            title: `${CATEGORY_LABELS[entry.category] || "⚠️"} Erreur critique`,
            description: entry.message,
            variant: "destructive",
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [toast]);

  const handleDismiss = useCallback(() => setDismissed(true), []);

  if (dismissed || alertes.length === 0) return null;

  // Comptage par catégorie
  const countsByCategory = alertes.reduce((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1;
    return acc;
  }, {});

  const journalUrl = createPageUrl(TARGET_PAGE);

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #FEF2F2 0%, #FFE4E6 100%)",
        border: "1px solid #FCA5A5",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#991B1B" }}>
          <AlertOctagon className="w-4 h-4" />
          <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>
            {alertes.length} erreur{alertes.length > 1 ? "s" : ""} critique{alertes.length > 1 ? "s" : ""} (24h)
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Masquer"
          style={{ background: "transparent", border: 0, color: "#991B1B", cursor: "pointer", padding: 4 }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {Object.entries(countsByCategory).map(([cat, n]) => (
          <Link
            key={cat}
            to={`${journalUrl}?alert=${encodeURIComponent(cat)}`}
            style={{
              fontSize: 12,
              background: "#FEE2E2",
              color: "#991B1B",
              padding: "4px 10px",
              borderRadius: 20,
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {CATEGORY_LABELS[cat] || cat} · {n}
          </Link>
        ))}
      </div>

      <Link
        to={journalUrl}
        style={{
          fontSize: 12,
          color: "#991B1B",
          fontWeight: 600,
          textDecoration: "underline",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          alignSelf: "flex-start",
        }}
      >
        Voir le Journal d'Audit <ExternalLink className="w-3 h-3" />
      </Link>
    </div>
  );
}
