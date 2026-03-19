import { useEffect, useState } from "react";
import { notifSystem } from "@/lib/notificationSystem";
import { supabase } from "@/integrations/supabase/client";
import { getActiveSession } from "@/components/useSessionGuard";
import { useQueryClient } from "@tanstack/react-query";

export default function NotificationManager() {
  const [toast, setToast] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    initNotifications();

    // iOS background notification fix: check missed notifications on visibility change
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        await checkMissedNotifications();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      notifSystem.unsubscribeAll();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const initNotifications = async () => {
    const active = getActiveSession();
    if (!active) return;

    await notifSystem.requestPermission();

    const count = await loadUnreadCount(active);
    notifSystem.updateBadge(count);

    const isAdmin = active.type === "admin" || active.type === "sous_admin";

    if (isAdmin) {
      notifSystem.subscribeAdmin((notif) => {
        notifSystem.updateBadge(notifSystem.unreadCount + 1);
        queryClient.invalidateQueries({ queryKey: ["notifications_admin"] });
        showInAppToast(notif);
      });
    } else {
      notifSystem.subscribeVendeur(active.data.id, (notif) => {
        notifSystem.updateBadge(notifSystem.unreadCount + 1);
        queryClient.invalidateQueries({ queryKey: ["notifications_vendeur"] });
        showInAppToast(notif);
      });
    }

    // Save initial check time
    localStorage.setItem("last_notif_check", new Date().toISOString());
  };

  const loadUnreadCount = async (active) => {
    try {
      const isAdmin = active.type === "admin" || active.type === "sous_admin";
      const table = isAdmin ? "notifications_admin" : "notifications_vendeur";
      const query = supabase.from(table).select("*", { count: "exact", head: true }).eq("lu", false);
      if (!isAdmin) query.eq("vendeur_id", active.data.id);
      const { count } = await query;
      return count || 0;
    } catch { return 0; }
  };

  const checkMissedNotifications = async () => {
    try {
      // Determine session from localStorage (admin first)
      const adminSession = JSON.parse(localStorage.getItem("admin_session") || "{}");
      const vendorSession = JSON.parse(localStorage.getItem("vendeur_session") || "{}");

      const isAdmin = !!(adminSession?.email && (adminSession?.role === "admin" || adminSession?.role === "sous_admin"));
      const session = isAdmin ? adminSession : vendorSession;
      if (!session?.email) return;

      const lastCheck = localStorage.getItem("last_notif_check") || new Date(Date.now() - 3600000).toISOString();
      const table = isAdmin ? "notifications_admin" : "notifications_vendeur";

      const query = supabase
        .from(table)
        .select("*")
        .eq("lu", false)
        .gte("created_at", lastCheck)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!isAdmin && session.id) {
        query.eq("vendeur_id", session.id);
      }

      const { data: missed } = await query;

      if (missed?.length > 0) {
        notifSystem.updateBadge(missed.length);
        // Invalidate queries so UI updates
        queryClient.invalidateQueries({ queryKey: [isAdmin ? "notifications_admin" : "notifications_vendeur"] });
        // Show latest missed notification as toast
        showInAppToast(missed[0]);
      }

      localStorage.setItem("last_notif_check", new Date().toISOString());
    } catch {}
  };

  const showInAppToast = (notif) => {
    setToast(notif);
    setTimeout(() => setToast(null), 4000);
  };

  if (!toast) return null;

  return (
    <div
      onClick={() => setToast(null)}
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[9998] w-[calc(100%-2rem)] max-w-[400px] rounded-xl p-3 flex items-center gap-3 cursor-pointer animate-in slide-in-from-top-2"
      style={{
        background: "rgba(10,16,55,0.97)",
        border: "1px solid rgba(245,166,35,0.4)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      <img src="/favicon.ico" alt="" className="w-8 h-8 rounded-lg" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white truncate">{toast.titre}</p>
        <p className="text-[11px] text-white/60 truncate">{toast.message?.split("\n")[0]?.slice(0, 60)}</p>
      </div>
      <span className="text-[10px] text-white/30 whitespace-nowrap">maintenant</span>
    </div>
  );
}
