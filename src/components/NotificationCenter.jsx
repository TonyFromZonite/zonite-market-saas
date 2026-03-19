import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getAdminSession, getSousAdminSession } from "@/components/useSessionGuard";

const ICONES_TYPE_VENDEUR = {
  kyc: "👤", info: "ℹ️", succes: "✅", alerte: "⚠️",
  paiement: "💰", support: "💬", commande: "📦",
};

const ICONES_TYPE_ADMIN = {
  kyc: "📋", support: "🎫", commande: "🛒",
  paiement: "💰", vendeur: "👤", info: "ℹ️",
};

const ADMIN_NAV_MAP = {
  kyc: "/GestionKYC",
  support: "/SupportAdmin",
  commande: "/Commandes",
  paiement: "/PaiementsVendeurs",
  vendeur: "/Vendeurs",
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "hier";
  return `${days}j`;
}

export default function NotificationCenter() {
  const [ouvert, setOuvert] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Detect role
  const adminSession = getAdminSession();
  const sousAdmin = getSousAdminSession();
  const isAdmin = !!(adminSession || sousAdmin);

  // Vendor session
  const vendeurSession = !isAdmin ? JSON.parse(localStorage.getItem("vendeur_session") || "{}") : {};
  const vendeurId = vendeurSession.id;

  const tableName = isAdmin ? "notifications_admin" : "notifications_vendeur";
  const queryKey = isAdmin ? ["notifications_admin"] : ["notifications_vendeur", vendeurId];

  // Unread count query
  const { data: unreadCount = 0 } = useQuery({
    queryKey: [...queryKey, "count"],
    queryFn: async () => {
      let q = supabase.from(tableName).select("*", { count: "exact", head: true }).eq("lu", false);
      if (!isAdmin && vendeurId) q = q.eq("vendeur_id", vendeurId);
      const { count } = await q;
      return count || 0;
    },
    refetchInterval: 15000,
    enabled: isAdmin || !!vendeurId,
  });

  // Full notifications query
  const { data: notifications = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase.from(tableName).select("*").order("created_at", { ascending: false }).limit(30);
      if (!isAdmin && vendeurId) q = q.eq("vendeur_id", vendeurId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
    enabled: isAdmin || !!vendeurId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!isAdmin && !vendeurId) return;
    const filter = !isAdmin && vendeurId ? `vendeur_id=eq.${vendeurId}` : undefined;
    const channel = supabase
      .channel(`notifs_${tableName}_realtime`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: tableName,
        ...(filter ? { filter } : {}),
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: [...queryKey, "count"] });
        queryClient.invalidateQueries({ queryKey });
        if (isAdmin && payload.new) {
          toast({
            title: payload.new.titre,
            description: payload.new.message,
            duration: 4000,
          });
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [isAdmin, vendeurId, tableName, queryClient, toast]);

  // Mark single as read
  const marquerCommeLueMutation = useMutation({
    mutationFn: async (notifId) => {
      await supabase.from(tableName).update({ lu: true }).eq("id", notifId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: [...queryKey, "count"] });
    },
  });

  // Delete single (vendor only)
  const supprimerMutation = useMutation({
    mutationFn: async (notifId) => {
      await supabase.from(tableName).delete().eq("id", notifId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: [...queryKey, "count"] });
    },
  });

  // Mark all as read
  const marquerToutCommeLuMutation = useMutation({
    mutationFn: async () => {
      let q = supabase.from(tableName).update({ lu: true }).eq("lu", false);
      if (!isAdmin && vendeurId) q = q.eq("vendeur_id", vendeurId);
      await q;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: [...queryKey, "count"] });
    },
  });

  const handleClickNotification = (notif) => {
    if (!notif.lu) marquerCommeLueMutation.mutate(notif.id);
    setOuvert(false);
    if (isAdmin) {
      const route = ADMIN_NAV_MAP[notif.type];
      if (route) navigate(route);
    } else if (notif.action_url) {
      navigate(notif.action_url);
    }
  };

  const icones = isAdmin ? ICONES_TYPE_ADMIN : ICONES_TYPE_VENDEUR;

  return (
    <Sheet open={ouvert} onOpenChange={setOuvert}>
      <SheetTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 flex items-center justify-center bg-destructive text-destructive-foreground text-[11px] font-bold rounded-full border-2 border-background"
              style={{ minWidth: 20, height: 20, padding: "0 4px" }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>
              🔔 Notifications {unreadCount > 0 ? `(${unreadCount})` : ""}
            </SheetTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => marquerToutCommeLuMutation.mutate()} disabled={marquerToutCommeLuMutation.isPending}>
                <Check className="w-4 h-4 mr-1" />Tout lire
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-muted border-t-foreground rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">Aucune notification</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleClickNotification(notif)}
                  className={`border rounded-lg p-3 cursor-pointer hover:shadow-md transition-all ${
                    !notif.lu ? "bg-accent/30 border-l-4 border-l-primary" : "bg-card border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl flex-shrink-0">{icones[notif.type] || "📢"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!notif.lu ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>
                          {notif.titre}
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {timeAgo(notif.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notif.message}</p>
                    </div>
                    {!isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); supprimerMutation.mutate(notif.id); }}
                        className="text-muted-foreground hover:text-destructive flex-shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
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
