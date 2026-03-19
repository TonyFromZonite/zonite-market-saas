import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminSession, getSousAdminSession } from "@/components/useSessionGuard";

const normalizePermissions = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

export default function useSousAdminPermissions() {
  const [sousAdmin, setSousAdmin] = useState(() => getSousAdminSession());
  const [permissions, setPermissions] = useState(() =>
    normalizePermissions(getSousAdminSession()?.permissions)
  );
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(() =>
    Boolean(getSousAdminSession())
  );

  useEffect(() => {
    const sessionSousAdmin = getSousAdminSession();

    setSousAdmin(sessionSousAdmin);
    setPermissions(normalizePermissions(sessionSousAdmin?.permissions));

    if (!sessionSousAdmin) {
      setIsLoadingPermissions(false);
      return;
    }

    let isMounted = true;

    const loadPermissions = async () => {
      setIsLoadingPermissions(true);

      try {
        const authResult = await supabase.auth.getUser();
        const currentUserId = sessionSousAdmin.user_id || authResult.data.user?.id;

        if (!currentUserId) return;

        const { data: saRecord, error: saError } = await supabase
          .from("sous_admins")
          .select("id, nom_role")
          .eq("user_id", currentUserId)
          .maybeSingle();

        if (saError) {
          console.error("Erreur chargement sous_admin:", saError);
          return;
        }

        if (!saRecord) return;

        const { data: permissionsRecord, error: permissionsError } = await supabase
          .from("admin_permissions")
          .select("modules_autorises")
          .eq("sous_admin_id", saRecord.id)
          .maybeSingle();

        if (permissionsError) {
          console.error("Erreur chargement admin_permissions:", permissionsError);
          return;
        }

        const nextPermissions = normalizePermissions(permissionsRecord?.modules_autorises);
        const nextSousAdmin = {
          ...sessionSousAdmin,
          id: saRecord.id,
          nom_role: saRecord.nom_role || sessionSousAdmin.nom_role || "Sous-admin",
          permissions: nextPermissions,
        };

        if (!isMounted) return;

        setSousAdmin(nextSousAdmin);
        setPermissions(nextPermissions);
        sessionStorage.setItem("sous_admin", JSON.stringify(nextSousAdmin));

        const adminSession = getAdminSession();
        if (adminSession?.role === "sous_admin") {
          sessionStorage.setItem(
            "admin_session",
            JSON.stringify({
              ...adminSession,
              permissions: nextPermissions,
            })
          );
        }
      } catch (error) {
        console.error("Erreur synchronisation permissions sous-admin:", error);
      } finally {
        if (isMounted) setIsLoadingPermissions(false);
      }
    };

    loadPermissions();

    return () => {
      isMounted = false;
    };
  }, []);

  return { sousAdmin, permissions, isLoadingPermissions };
}
