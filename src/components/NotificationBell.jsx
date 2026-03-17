import React, { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sellerId, setSellerId] = useState(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check admin role
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const adminRole = roleData?.some(r => r.role === "admin" || r.role === "sous_admin");
      setIsAdmin(!!adminRole);

      // Get seller id
      const { data: seller } = await supabase.from("sellers").select("id").eq("user_id", user.id).single();
      if (seller) setSellerId(seller.id);
    };
    init();
  }, []);

  useEffect(() => {
    const chargerNotifications = async () => {
      try {
        const notifs = [];

        // Vendor notifications
        if (sellerId) {
          const { data } = await supabase
            .from("notifications_vendeur")
            .select("*")
            .eq("vendeur_id", sellerId)
            .order("created_at", { ascending: false })
            .limit(20);
          if (data) notifs.push(...data.map(n => ({ ...n, source: "vendeur" })));
        }

        // Admin notifications
        if (isAdmin) {
          const { data } = await supabase
            .from("notifications_admin")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(20);
          if (data) notifs.push(...data.map(n => ({ ...n, source: "admin" })));
        }

        notifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setNotifications(notifs);
      } catch (_) {}
    };

    if (sellerId || isAdmin) {
      chargerNotifications();
      const interval = setInterval(chargerNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [sellerId, isAdmin]);

  const nonLues = notifications.filter(n => !n.lu).length;

  const markAsRead = async (notif) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, lu: true } : n));
    const table = notif.source === "admin" ? "notifications_admin" : "notifications_vendeur";
    await supabase.from(table).update({ lu: true }).eq("id", notif.id);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOuvert(!ouvert)}
        className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {nonLues > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <div className="absolute top-12 right-0 w-80 max-h-96 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-40">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="font-semibold text-slate-900">Notifications</h3>
            <button onClick={() => setOuvert(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto max-h-80">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune notification</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n)}
                  className={`px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer ${n.lu ? "" : "bg-blue-50"}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.lu && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 line-clamp-2">{n.titre}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(n.created_at).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
