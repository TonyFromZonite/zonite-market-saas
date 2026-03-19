import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Bell, ChevronLeft, CheckCheck, Star } from "lucide-react";
import VendeurBottomNav from "@/components/VendeurBottomNav";

const COULEURS = {
  info: "bg-blue-50 border-blue-100 text-blue-800",
  succes: "bg-emerald-50 border-emerald-100 text-emerald-800",
  alerte: "bg-yellow-50 border-yellow-100 text-yellow-800",
  paiement: "bg-purple-50 border-purple-100 text-purple-800",
};
const EMOJIS = { info: "ℹ️", succes: "✅", alerte: "⚠️", paiement: "💰" };
const TYPES = [
  { val: "tous", label: "Tous" },
  { val: "info", label: "Info" },
  { val: "succes", label: "Succès" },
  { val: "alerte", label: "Alertes" },
  { val: "paiement", label: "Paiements" },
];
const PERIODES = [
  { val: "tous", label: "Toutes dates" },
  { val: "today", label: "Aujourd'hui" },
  { val: "week", label: "Cette semaine" },
  { val: "month", label: "Ce mois" },
];

export default function NotificationsVendeur() {
  const [sellerId, setSellerId] = useState(null);
  const [filtreType, setFiltreType] = useState("tous");
  const [filtrePeriode, setFiltrePeriode] = useState("tous");
  const [filtreLu, setFiltreLu] = useState("tous");
  const queryClient = useQueryClient();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = createPageUrl("Connexion"); return; }
      const { data } = await supabase.from("sellers").select("id").eq("user_id", user.id).single();
      if (data) {
        setSellerId(data.id);
        // Mark all as read on page visit
        await supabase
          .from("notifications_vendeur")
          .update({ lu: true })
          .eq("vendeur_id", data.id)
          .eq("lu", false);
        queryClient.invalidateQueries({ queryKey: ["notifications-vendeur", data.id] });
        queryClient.invalidateQueries({ queryKey: ["notifications_count"] });
      }
    };
    init();
  }, []);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifs_vendeur_page", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications_vendeur")
        .select("*")
        .eq("vendeur_id", sellerId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!sellerId,
  });

  const filtrer = (notifs) => {
    let res = notifs;
    if (filtreType !== "tous") res = res.filter(n => n.type === filtreType);
    if (filtreLu === "non_lu") res = res.filter(n => !n.lu);
    if (filtrePeriode !== "tous") {
      const now = new Date();
      res = res.filter(n => {
        const d = new Date(n.created_at);
        if (filtrePeriode === "today") return d.toDateString() === now.toDateString();
        if (filtrePeriode === "week") return (now - d) < 7 * 86400000;
        if (filtrePeriode === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        return true;
      });
    }
    return res;
  };

  const formaterDate = d => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

  const notifsFiltrees = filtrer(notifications);
  const nbNonLues = notifications.filter(n => !n.lu).length;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-[#1a1f5e] text-white px-4 pb-4 sticky top-0 z-10" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top, 0px))" }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("EspaceVendeur")}>
              <ChevronLeft className="w-6 h-6 text-white" />
            </Link>
            <h1 className="text-lg font-bold">Notifications</h1>
            {nbNonLues > 0 && (
              <span className="bg-[#F5C518] text-[#1a1f5e] text-xs font-bold px-2 py-0.5 rounded-full">{nbNonLues}</span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-slate-100 px-4 py-3 space-y-2 sticky top-[60px] z-10">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TYPES.map(t => (
            <button
              key={t.val}
              onClick={() => setFiltreType(t.val)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filtreType === t.val ? "bg-[#1a1f5e] text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {PERIODES.map(p => (
            <button
              key={p.val}
              onClick={() => setFiltrePeriode(p.val)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filtrePeriode === p.val ? "bg-[#1a1f5e] text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setFiltreLu(filtreLu === "non_lu" ? "tous" : "non_lu")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filtreLu === "non_lu" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            Non lues
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 max-w-screen-md mx-auto w-full">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : notifsFiltrees.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Aucune notification</p>
          </div>
        ) : (
          notifsFiltrees.map(n => (
            <div
              key={n.id}
              className={`border rounded-2xl p-4 transition-opacity relative ${COULEURS[n.type] || COULEURS.info} ${n.lu ? "opacity-60" : ""}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{EMOJIS[n.type] || "ℹ️"}</span>
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{n.titre}</p>
                    {!n.lu && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>}
                  </div>
                  <p className="text-sm mt-0.5">{n.message}</p>
                  <p className="text-xs opacity-60 mt-1">{formaterDate(n.created_at)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      
    </div>
  );
}
