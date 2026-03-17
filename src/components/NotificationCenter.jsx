import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, X, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ICONES_TYPE = {
  kyc: "👤",
  info: "ℹ️",
  succes: "✅",
  alerte: "⚠️",
  paiement: "💰",
  support: "💬",
  commande: "📦",
};

export default function NotificationCenter() {
  const [ouvert, setOuvert] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Get current seller from session
  const session = JSON.parse(sessionStorage.getItem("vendeur_session") || "{}");
  const vendeurId = session.id;

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications_vendeur", vendeurId],
    queryFn: async () => {
      if (!vendeurId) return [];
      const { data, error } = await supabase
        .from("notifications_vendeur")
        .select("*")
        .eq("vendeur_id", vendeurId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
    enabled: !!vendeurId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!vendeurId) return;
    const channel = supabase
      .channel("notifs_vendeur_realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications_vendeur",
        filter: `vendeur_id=eq.${vendeurId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications_vendeur", vendeurId] });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [vendeurId, queryClient]);

  const marquerCommeLueMutation = useMutation({
    mutationFn: async (notifId) => {
      await supabase.from("notifications_vendeur").update({ lu: true }).eq("id", notifId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications_vendeur", vendeurId] }),
  });

  const supprimerMutation = useMutation({
    mutationFn: async (notifId) => {
      await supabase.from("notifications_vendeur").delete().eq("id", notifId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications_vendeur", vendeurId] }),
  });

  const marquerToutCommeLuMutation = useMutation({
    mutationFn: async () => {
      const nonLues = notifications.filter((n) => !n.lu);
      await Promise.all(
        nonLues.map((n) => supabase.from("notifications_vendeur").update({ lu: true }).eq("id", n.id))
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications_vendeur", vendeurId] }),
  });

  const handleClickNotification = (notif) => {
    if (!notif.lu) marquerCommeLueMutation.mutate(notif.id);
    if (notif.action_url) {
      setOuvert(false);
      navigate(notif.action_url);
    }
  };

  const nbNonLues = notifications.filter((n) => !n.lu).length;

  return (
    <Sheet open={ouvert} onOpenChange={setOuvert}>
      <SheetTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5 text-slate-600" />
          {nbNonLues > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center bg-red-500 text-white text-xs px-1">
              {nbNonLues > 9 ? "9+" : nbNonLues}
            </Badge>
          )}
        </button>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Notifications ({nbNonLues} non lues)</SheetTitle>
            {nbNonLues > 0 && (
              <Button variant="ghost" size="sm" onClick={() => marquerToutCommeLuMutation.mutate()} disabled={marquerToutCommeLuMutation.isPending}>
                <Check className="w-4 h-4 mr-1" />Tout marquer lu
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm">Aucune notification</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <div key={notif.id} onClick={() => handleClickNotification(notif)}
                  className={`border rounded-lg p-3 cursor-pointer hover:shadow-md transition-all bg-white border-slate-200 ${!notif.lu ? "border-l-4 border-l-blue-500" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="text-2xl flex-shrink-0">{ICONES_TYPE[notif.type] || "📢"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${!notif.lu ? "text-slate-900" : "text-slate-600"}`}>{notif.titre}</p>
                        <button onClick={(e) => { e.stopPropagation(); supprimerMutation.mutate(notif.id); }} className="text-slate-400 hover:text-red-500 flex-shrink-0">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{notif.message}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(notif.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
