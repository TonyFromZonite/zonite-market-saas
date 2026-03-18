import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCachedQuery } from "@/components/CacheManager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

import {
  ShoppingBag, Package,
  Clock, CheckCircle2, XCircle, Truck, Plus,
  AlertCircle, Upload, Loader2, LogOut, Trophy, Wallet, TrendingUp, CalendarDays
} from "lucide-react";
import { getVendeurSession, clearAllSessions } from "@/components/useSessionGuard";
import { LOGO_URL as LOGO } from "@/components/constants";
import NotificationCenterVendeur from "@/components/NotificationCenterVendeur";
import VendeurBottomNav from "@/components/VendeurBottomNav";
import { SELLER_STATUSES, canAccessFeature, shouldShowTrainingModal } from "@/components/SellerStatusEngine";
import BanniereKycPending from "@/components/BanniereKycPending";
import { filterTable, getCurrentUser, subscribeToTable, uploadFile } from "@/lib/supabaseHelpers";
import { supabase } from "@/integrations/supabase/client";

const STATUTS = {
  en_attente_validation_admin: { label: "En attente", couleur: "bg-yellow-100 text-yellow-800" },
  validee_admin:               { label: "Validée", couleur: "bg-blue-100 text-blue-800" },
  attribuee_livreur:           { label: "Livreur attribué", couleur: "bg-indigo-100 text-indigo-800" },
  en_livraison:                { label: "En livraison 🚚", couleur: "bg-purple-100 text-purple-800" },
  livree:                      { label: "Livrée ✓", couleur: "bg-emerald-100 text-emerald-800" },
  echec_livraison:             { label: "Échec", couleur: "bg-orange-100 text-orange-800" },
  annulee:                     { label: "Annulée", couleur: "bg-red-100 text-red-800" },
};

export default function EspaceVendeur() {
  const [utilisateur, setUtilisateur] = useState(null);
  const [compteVendeur, setCompteVendeur] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [restrictionMessage, setRestrictionMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // KYC modal state
  const [typeDocument, setTypeDocument] = useState("cni");
  const [kycForm, setKycForm] = useState({ photo_identite_url: "", photo_identite_verso_url: "", selfie_url: "" });
  const [kycUpload, setKycUpload] = useState({ id: false, idVerso: false, selfie: false });
  const [kycErreur, setKycErreur] = useState("");
  const [kycEnCours, setKycEnCours] = useState(false);

  // Transaction history
  const [historyFilter, setHistoryFilter] = useState("tout");

  const uploadKycFile = async (fichier, champ) => {
    const key = champ === "photo_identite_url" ? "id" : champ === "photo_identite_verso_url" ? "idVerso" : "selfie";
    setKycUpload(p => ({ ...p, [key]: true }));
    const { file_url } = await uploadFile(fichier);
    setKycForm(p => ({ ...p, [champ]: file_url }));
    setKycUpload(p => ({ ...p, [key]: false }));
  };

  const soumettreKyc = async () => {
    if (!kycForm.photo_identite_url) { setKycErreur("Veuillez uploader votre pièce d'identité."); return; }
    if (typeDocument === "cni" && !kycForm.photo_identite_verso_url) { setKycErreur("Veuillez uploader le verso de votre CNI."); return; }
    if (!kycForm.selfie_url) { setKycErreur("Veuillez uploader votre selfie."); return; }
    setKycEnCours(true);
    setKycErreur("");
    const { error } = await supabase
      .from('sellers')
      .update({
        kyc_document_recto_url: kycForm.photo_identite_url,
        kyc_document_verso_url: kycForm.photo_identite_verso_url || null,
        kyc_selfie_url: kycForm.selfie_url,
        kyc_type_document: typeDocument,
        statut_kyc: 'en_attente',
        seller_status: 'kyc_pending',
      })
      .eq('id', compteVendeur.id);

    setKycEnCours(false);

    if (!error) {
      await supabase.from('notifications_admin').insert({
        titre: 'Nouveau KYC à valider',
        message: `${compteVendeur.full_name} (${compteVendeur.email}) a soumis son KYC`,
        type: 'kyc',
        vendeur_email: compteVendeur.email,
        reference_id: compteVendeur.id,
      });
      setCompteVendeur(prev => ({ ...prev, seller_status: 'kyc_pending', statut_kyc: 'en_attente' }));
    } else {
      setKycErreur(error.message || "Erreur lors de la soumission.");
    }
  };

  const handleLogout = async () => {
    clearAllSessions();
    await supabase.auth.signOut();
    window.location.href = createPageUrl("Connexion");
  };

  useEffect(() => {
    const charger = async () => {
      try {
        let session = getVendeurSession();
        if (!session) {
          try {
            const user = await getCurrentUser();
            if (user && user.role === 'user') {
              session = { role: 'vendeur', email: user.email };
              sessionStorage.setItem("vendeur_session", JSON.stringify(session));
            }
          } catch (_) {}
        }
        if (!session) {
          window.location.href = createPageUrl("Connexion");
          return;
        }
        setUtilisateur({ email: session.email });
        if (session.id && session.nom_complet) {
          setCompteVendeur(session);
          const unsubscribe = subscribeToTable("sellers", (event) => {
            if (event.id === session.id) setCompteVendeur(event.data);
          });
          setChargement(false);
          return unsubscribe;
        }
        const emailVendeur = session.email;
        try {
          const sellers = await filterTable("sellers", { email: emailVendeur });
          if (sellers.length > 0) {
            const sellerData = sellers[0];
            setCompteVendeur(sellerData);
            sessionStorage.setItem("vendeur_session", JSON.stringify({ ...session, ...sellerData, role: 'vendeur' }));
            const unsubscribe = subscribeToTable("sellers", (event) => {
              if (event.data?.email === emailVendeur) setCompteVendeur(event.data);
            });
            setChargement(false);
            return unsubscribe;
          } else {
            window.location.href = createPageUrl("Connexion");
          }
        } catch (err) {
          console.error('Erreur chargement vendeur:', err);
          window.location.href = createPageUrl("Connexion");
        }
      } catch (error) {
        console.error('Erreur chargement espace vendeur:', error);
        window.location.href = createPageUrl("Connexion");
      }
    };
    charger();
  }, []);

  const { data: commandes = [] } = useCachedQuery(
    'COMMANDES',
    () => filterTable("commandes_vendeur", { vendeur_id: compteVendeur.id }, "-created_at", 50),
    { ttl: 5 * 60 * 1000, enabled: !!compteVendeur?.id }
  );

  const { data: compteActualise, isLoading: loadingCompte } = useCachedQuery(
    'COMPTE_VENDEUR',
    () => filterTable("sellers", { id: compteVendeur.id }),
    { ttl: 3 * 60 * 1000, enabled: !!compteVendeur?.id }
  );

  // SECTION A — Vendor personal stats
  const { data: vendeurStats } = useQuery({
    queryKey: ["vendeur_stats", compteVendeur?.id],
    queryFn: async () => {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const [ventesWeek, ventesMois, ventesAnnee, commandesEC] = await Promise.all([
        supabase.from('ventes').select('montant_total, commission_vendeur').eq('vendeur_id', compteVendeur.id).gte('created_at', startOfWeek.toISOString()),
        supabase.from('ventes').select('montant_total, commission_vendeur').eq('vendeur_id', compteVendeur.id).gte('created_at', startOfMonth.toISOString()),
        supabase.from('ventes').select('montant_total, commission_vendeur').eq('vendeur_id', compteVendeur.id).gte('created_at', startOfYear.toISOString()),
        supabase.from('commandes_vendeur').select('id').eq('vendeur_id', compteVendeur.id).in('statut', ['en_attente_validation_admin', 'validee_admin', 'attribuee_livreur', 'en_livraison']),
      ]);

      const sum = (arr, field) => (arr || []).reduce((s, v) => s + (v[field] || 0), 0);
      return {
        caWeek: sum(ventesWeek.data, 'montant_total'),
        commWeek: sum(ventesWeek.data, 'commission_vendeur'),
        caMois: sum(ventesMois.data, 'montant_total'),
        commMois: sum(ventesMois.data, 'commission_vendeur'),
        caAnnee: sum(ventesAnnee.data, 'montant_total'),
        commAnnee: sum(ventesAnnee.data, 'commission_vendeur'),
        commandesEnCours: commandesEC.data?.length || 0,
      };
    },
    enabled: !!compteVendeur?.id,
    staleTime: 2 * 60 * 1000,
  });

  // SECTION B — Top vendeurs
  const { data: topVendeurs } = useQuery({
    queryKey: ["top_vendeurs"],
    queryFn: async () => {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const [topWeek, topMonth, topYear] = await Promise.all([
        supabase.from('ventes').select('vendeur_id, vendeur_email, montant_total').gte('created_at', startOfWeek.toISOString()),
        supabase.from('ventes').select('vendeur_id, vendeur_email, montant_total').gte('created_at', startOfMonth.toISOString()),
        supabase.from('ventes').select('vendeur_id, vendeur_email, montant_total').gte('created_at', startOfYear.toISOString()),
      ]);

      const groupByVendeur = (ventes) => {
        const map = {};
        (ventes || []).forEach(v => {
          if (!map[v.vendeur_id]) map[v.vendeur_id] = { vendeur_id: v.vendeur_id, email: v.vendeur_email, total: 0 };
          map[v.vendeur_id].total += v.montant_total;
        });
        return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 3);
      };

      return {
        topWeek: groupByVendeur(topWeek.data),
        topMonth: groupByVendeur(topMonth.data),
        topYear: groupByVendeur(topYear.data),
      };
    },
    enabled: !!compteVendeur?.id,
    staleTime: 5 * 60 * 1000,
  });

  // SECTION E — Transaction history
  const { data: historique = [] } = useQuery({
    queryKey: ["vendeur_historique", compteVendeur?.id],
    queryFn: async () => {
      const [commandesH, ventesH, paiementsH] = await Promise.all([
        supabase.from('commandes_vendeur').select('id, reference_commande, produit_nom, quantite, montant_total, statut, created_at, updated_at, notes_admin').eq('vendeur_id', compteVendeur.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('ventes').select('id, montant_total, commission_vendeur, created_at').eq('vendeur_id', compteVendeur.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('demandes_paiement_vendeur').select('id, montant, statut, operateur_mobile_money, numero_mobile_money, created_at, traite_at').eq('vendeur_id', compteVendeur.id).order('created_at', { ascending: false }).limit(20),
      ]);

      const getCommandeColor = (statut) => ({ livree: '#22c55e', echec_livraison: '#ef4444', annulee: '#ef4444', en_livraison: '#f5a623', validee_admin: '#3b82f6', en_attente_validation_admin: '#94a3b8' }[statut] || '#94a3b8');
      const getPaiementColor = (statut) => ({ payee: '#22c55e', paye: '#22c55e', rejetee: '#ef4444', rejete: '#ef4444', en_attente: '#f5a623' }[statut] || '#94a3b8');

      const history = [
        ...(commandesH.data || []).map(c => ({
          type: 'commande', date: c.updated_at || c.created_at,
          titre: `Commande ${c.reference_commande || c.id.slice(0, 8)}`,
          description: `${c.produit_nom} × ${c.quantite} — ${STATUTS[c.statut]?.label || c.statut}`,
          montant: c.montant_total, statut: c.statut, notes: c.notes_admin, icon: '📦', color: getCommandeColor(c.statut),
        })),
        ...(ventesH.data || []).map(v => ({
          type: 'vente', date: v.created_at,
          titre: 'Livraison confirmée ✅',
          description: `Commission créditée`,
          montant: v.commission_vendeur, icon: '💚', color: '#22c55e',
        })),
        ...(paiementsH.data || []).map(p => ({
          type: 'paiement', date: p.traite_at || p.created_at,
          titre: `Retrait ${p.statut === 'payee' || p.statut === 'paye' ? '✅' : p.statut === 'en_attente' ? '⏳' : '❌'}`,
          description: `${p.operateur_mobile_money} — ${p.numero_mobile_money}`,
          montant: p.montant, statut: p.statut, icon: '💰', color: getPaiementColor(p.statut),
        })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      return history;
    },
    enabled: !!compteVendeur?.id,
    staleTime: 2 * 60 * 1000,
  });

  const soldeAffiche = compteActualise?.[0] || compteVendeur;

  if (loadingCompte && !compteActualise) {
    return <div className="p-4 space-y-4">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>;
  }

  const formater = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

  if (chargement) {
    return <div className="p-4 space-y-4">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>;
  }

  if (!compteVendeur) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-lg">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">Compte introuvable</h2>
          <p className="text-sm text-slate-500 mb-4">Aucun compte vendeur n'est associé à cet email.</p>
          <Link to={createPageUrl("InscriptionVendeur")}><Button className="w-full bg-[#1a1f5e] hover:bg-[#141952]">Créer mon compte</Button></Link>
        </div>
      </div>
    );
  }

  if (!canAccessFeature(compteVendeur.seller_status, "dashboard")) {
    if (compteVendeur.seller_status === SELLER_STATUSES.PENDING_VERIFICATION) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-lg">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-900 mb-2">Email à vérifier</h2>
            <p className="text-sm text-slate-500">Veuillez vérifier votre email pour continuer.</p>
          </div>
        </div>
      );
    }
  }

  if (compteVendeur.statut_kyc === "rejete" || compteVendeur.seller_status === SELLER_STATUSES.KYC_REJECTED) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-lg">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">Dossier KYC rejeté</h2>
          {compteVendeur.kyc_raison_rejet && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 mb-4 text-left">
              <p className="font-semibold mb-1">Raison du rejet :</p>
              <p>{compteVendeur.kyc_raison_rejet}</p>
            </div>
          )}
          <p className="text-sm text-slate-500 mb-4">Vous pouvez corriger et resoumettre vos documents.</p>
          <Link to={createPageUrl("ResoumissionKYC")}><Button className="w-full bg-[#1a1f5e] hover:bg-[#141952] mb-2">📝 Resoumettre mon dossier</Button></Link>
        </div>
      </div>
    );
  }

  const commandesEnAttente = (commandes || []).filter(c => ["en_attente_validation_admin", "validee_admin", "attribuee_livreur"].includes(c.statut)).length;
  const commandesReussies = (commandes || []).filter(c => c.statut === "livree").length;
  const commandesEchouees = (commandes || []).filter(c => ["echec_livraison", "annulee"].includes(c.statut)).length;
  const commandesEnLivraison = (commandes || []).filter(c => c.statut === "en_livraison").length;

  if (!compteVendeur || !soldeAffiche) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
          <p className="text-slate-500 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  const filteredHistory = historyFilter === "tout" ? historique : historique.filter(h => h.type === historyFilter);

  const TopVendeursSection = ({ data, currentVendeurId }) => {
    if (!data || data.length === 0) {
      return <p className="text-sm text-slate-400 text-center py-4">Aucune vente pour cette période</p>;
    }
    const medals = ['🥇', '🥈', '🥉'];
    return (
      <div className="space-y-2">
        {data.map((v, i) => {
          const isCurrentVendeur = v.vendeur_id === currentVendeurId;
          return (
            <div key={v.vendeur_id} className={`flex items-center gap-3 p-3 rounded-xl ${isCurrentVendeur ? 'bg-yellow-50 border border-yellow-200' : 'bg-slate-50'}`}>
              <span className="text-2xl">{medals[i]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-900 truncate">
                  {v.email?.split('@')[0]} {isCurrentVendeur && '⭐'}
                </p>
                <p className="text-xs text-slate-500">CA : {formater(v.total)}</p>
              </div>
              {isCurrentVendeur && <Badge className="bg-yellow-100 text-yellow-800 border-0 text-xs">Vous</Badge>}
            </div>
          );
        })}
      </div>
    );
  };

  const formatRelativeTime = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "hier";
    return `${days}j`;
  };

  return (
    <div className="min-h-screen bg-slate-50" style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}>
      {restrictionMessage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-lg">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-900 mb-2">Accès restreint</h2>
            <p className="text-sm text-slate-500 mb-4">{restrictionMessage}</p>
            <Button onClick={() => setRestrictionMessage(null)} className="w-full bg-[#1a1f5e] hover:bg-[#141952]">Fermer</Button>
          </div>
        </div>
      )}

      {/* Modal KYC obligatoire */}
      {compteVendeur.seller_status === SELLER_STATUSES.KYC_REQUIRED && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3"><span className="text-2xl">📋</span></div>
              <h2 className="text-lg font-bold text-slate-900">Complétez votre vérification KYC</h2>
              <p className="text-xs text-slate-500 mt-1">Uploadez vos documents pour activer votre compte.</p>
            </div>
            <div className="flex gap-2 mb-3">
              <button onClick={() => { setTypeDocument("cni"); setKycForm(p => ({ ...p, photo_identite_verso_url: "" })); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${typeDocument === "cni" ? "bg-blue-600 text-white border-blue-600" : "bg-slate-100 text-slate-600 border-slate-200"}`}>🪪 CNI</button>
              <button onClick={() => { setTypeDocument("passeport"); setKycForm(p => ({ ...p, photo_identite_verso_url: "" })); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${typeDocument === "passeport" ? "bg-blue-600 text-white border-blue-600" : "bg-slate-100 text-slate-600 border-slate-200"}`}>📘 Passeport</button>
            </div>
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-1">{typeDocument === "cni" ? "CNI Recto *" : "Page principale *"}</p>
              <label className={`flex flex-col items-center justify-center h-20 rounded-xl border-2 border-dashed cursor-pointer transition-all ${kycForm.photo_identite_url ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"}`}>
                {kycUpload.id ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> :
                  kycForm.photo_identite_url ? <><CheckCircle2 className="w-5 h-5 text-emerald-500 mb-1" /><span className="text-xs text-emerald-600 font-medium">Uploadé ✓</span></> :
                  <><Upload className="w-5 h-5 text-slate-400 mb-1" /><span className="text-xs text-slate-400">Appuyer pour uploader</span></>}
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadKycFile(e.target.files[0], "photo_identite_url")} />
              </label>
            </div>
            {typeDocument === "cni" && (
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-1">CNI Verso *</p>
                <label className={`flex flex-col items-center justify-center h-20 rounded-xl border-2 border-dashed cursor-pointer transition-all ${kycForm.photo_identite_verso_url ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"}`}>
                  {kycUpload.idVerso ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> :
                    kycForm.photo_identite_verso_url ? <><CheckCircle2 className="w-5 h-5 text-emerald-500 mb-1" /><span className="text-xs text-emerald-600 font-medium">Uploadé ✓</span></> :
                    <><Upload className="w-5 h-5 text-slate-400 mb-1" /><span className="text-xs text-slate-400">Appuyer pour uploader</span></>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadKycFile(e.target.files[0], "photo_identite_verso_url")} />
                </label>
              </div>
            )}
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-1">Selfie avec pièce d'identité *</p>
              <label className={`flex flex-col items-center justify-center h-20 rounded-xl border-2 border-dashed cursor-pointer transition-all ${kycForm.selfie_url ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"}`}>
                {kycUpload.selfie ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> :
                  kycForm.selfie_url ? <><CheckCircle2 className="w-5 h-5 text-emerald-500 mb-1" /><span className="text-xs text-emerald-600 font-medium">Uploadé ✓</span></> :
                  <><Upload className="w-5 h-5 text-slate-400 mb-1" /><span className="text-xs text-slate-400">Selfie avec votre pièce visible</span></>}
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadKycFile(e.target.files[0], "selfie_url")} />
              </label>
            </div>
            {kycErreur && <p className="text-red-500 text-xs mb-3 text-center">{kycErreur}</p>}
            <Button onClick={soumettreKyc} disabled={kycEnCours || kycUpload.id || kycUpload.idVerso || kycUpload.selfie}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
              {kycEnCours ? <Loader2 className="w-4 h-4 animate-spin" /> : "Soumettre mes documents"}
            </Button>
          </div>
        </div>
      )}

      {/* Training Required modal */}
      {shouldShowTrainingModal(compteVendeur.seller_status, compteVendeur.training_completed) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-lg">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-3xl">🎬</span></div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Formation obligatoire</h2>
            <p className="text-sm text-slate-500 mb-4">Regardez la vidéo de présentation ZONITE pour déverrouiller l'accès complet.</p>
            <Link to={createPageUrl("VideoFormation")}><Button className="w-full bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1f5e] font-bold">Commencer la formation →</Button></Link>
          </div>
        </div>
      )}

      {compteVendeur.seller_status === SELLER_STATUSES.KYC_PENDING && <BanniereKycPending />}

      {/* Header with logout */}
      <div className="bg-[#1a1f5e] text-white px-3 pt-4 pb-8" style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 0px))" }}>
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2">
            <img src={LOGO} alt="Zonite" className="h-8 w-8 rounded-lg object-contain bg-white p-0.5 flex-shrink-0" />
            <div>
              <span className="text-xs font-bold tracking-tight leading-none">ZONITE <span className="text-[#F5C518]">Vendeurs</span></span>
              <p className="text-slate-300 text-[11px] mt-0.5 truncate max-w-[160px]">👋 {compteVendeur.full_name || compteVendeur.nom_complet}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationCenterVendeur />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg border-none text-red-300 hover:text-red-200 hover:bg-white/10 transition-colors text-xs font-medium"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* Solde */}
        <div className="mt-3 bg-white/10 rounded-xl p-3">
          <p className="text-slate-300 text-[11px] mb-0.5">Solde commissions</p>
          <p className="text-2xl font-bold text-[#F5C518]">{formater(soldeAffiche.solde_commission)}</p>
          <p className="text-[11px] text-slate-300 mt-0.5">Total gagné : {formater(soldeAffiche.total_commissions_gagnees)}</p>
        </div>
      </div>

      {/* SECTION A — Stats personnelles */}
      <div className="px-3 -mt-4">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-white rounded-xl p-2.5 shadow-sm text-center">
            <div className="w-7 h-7 bg-yellow-50 rounded-lg flex items-center justify-center mx-auto mb-1"><Wallet className="w-3.5 h-3.5 text-yellow-600" /></div>
            <p className="text-xs font-bold text-slate-900 truncate">{formater(soldeAffiche.solde_commission)}</p>
            <p className="text-[9px] text-slate-500 truncate">Solde</p>
          </div>
          <div className="bg-white rounded-xl p-2.5 shadow-sm text-center">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-1"><Package className="w-3.5 h-3.5 text-blue-600" /></div>
            <p className="text-sm font-bold text-slate-900">{vendeurStats?.commandesEnCours || 0}</p>
            <p className="text-[9px] text-slate-500">En cours</p>
          </div>
          <div className="bg-white rounded-xl p-2.5 shadow-sm text-center">
            <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center mx-auto mb-1"><Trophy className="w-3.5 h-3.5 text-emerald-600" /></div>
            <p className="text-xs font-bold text-slate-900 truncate">{formater(soldeAffiche.total_commissions_gagnees)}</p>
            <p className="text-[9px] text-slate-500 truncate">Total gagné</p>
          </div>
        </div>

        {/* Stats CA par période */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: "Semaine", ca: vendeurStats?.caWeek, comm: vendeurStats?.commWeek },
            { label: "Mois", ca: vendeurStats?.caMois, comm: vendeurStats?.commMois },
            { label: "Année", ca: vendeurStats?.caAnnee, comm: vendeurStats?.commAnnee },
          ].map(({ label, ca, comm }) => (
            <div key={label} className="bg-white rounded-xl p-2.5 shadow-sm">
              <p className="text-[9px] text-slate-500 font-medium mb-0.5">{label}</p>
              <p className="text-[11px] font-bold text-slate-900 truncate">{formater(ca)}</p>
              <p className="text-[10px] text-emerald-600 truncate">+{formater(comm)}</p>
            </div>
          ))}
        </div>

        {/* SECTION C — Quick payment button */}
        {(soldeAffiche.solde_commission || 0) > 0 ? (
          <button
            onClick={() => navigate(createPageUrl("DemandePaiement"))}
            className="w-full mb-3 p-3 rounded-xl border-none text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #f5a623, #e8940f)', boxShadow: '0 4px 12px rgba(245,166,35,0.3)' }}
          >
            💰 Demander un paiement
            <span className="bg-white/30 px-2.5 py-0.5 rounded-full text-xs">{formater(soldeAffiche.solde_commission)}</span>
          </button>
        ) : (
          <div className="w-full mb-3 p-3 rounded-xl bg-slate-100 text-center text-slate-400 text-xs">
            💰 Aucune commission disponible
          </div>
        )}

        {/* Order stats cards */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: "Attente", val: commandesEnAttente, icone: Clock, couleur: "text-yellow-600", bg: "bg-yellow-50" },
            { label: "Livraison", val: commandesEnLivraison, icone: Truck, couleur: "text-purple-600", bg: "bg-purple-50" },
            { label: "Réussies", val: commandesReussies, icone: CheckCircle2, couleur: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Échouées", val: commandesEchouees, icone: XCircle, couleur: "text-red-600", bg: "bg-red-50" },
          ].map(({ label, val, icone: Icone, couleur, bg }) => (
            <div key={label} className="bg-white rounded-xl p-2.5 shadow-sm text-center">
              <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center mx-auto mb-1`}><Icone className={`w-3.5 h-3.5 ${couleur}`} /></div>
              <p className="text-lg font-bold text-slate-900">{val}</p>
              <p className="text-[9px] text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {canAccessFeature(compteVendeur.seller_status, "sales", compteVendeur.training_completed) ? (
            <Link to={createPageUrl("NouvelleCommandeVendeur")}>
              <div className="bg-[#1a1f5e] text-white rounded-xl p-3 flex items-center gap-2.5 hover:bg-[#141952] transition-colors">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><Plus className="w-4 h-4" /></div>
                <div><p className="font-bold text-xs">Nouvelle</p><p className="text-[10px] text-slate-300">commande</p></div>
              </div>
            </Link>
          ) : (
            <button disabled className="cursor-not-allowed w-full">
              <div className="bg-slate-300 text-slate-500 rounded-xl p-3 flex items-center gap-2.5 opacity-60">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><Plus className="w-4 h-4" /></div>
                <div><p className="font-bold text-xs">Nouvelle</p><p className="text-[10px]">commande</p></div>
              </div>
            </button>
          )}
          {canAccessFeature(compteVendeur.seller_status, "catalog", compteVendeur.training_completed) ? (
            <Link to={createPageUrl("CatalogueVendeur")}>
              <div className="bg-[#F5C518] text-[#1a1f5e] rounded-xl p-3 flex items-center gap-2.5 hover:bg-[#e0b010] transition-colors">
                <div className="w-8 h-8 bg-[#1a1f5e]/10 rounded-lg flex items-center justify-center"><Package className="w-4 h-4" /></div>
                <div><p className="font-bold text-xs">Catalogue</p><p className="text-[10px] text-[#1a1f5e]/70">produits</p></div>
              </div>
            </Link>
          ) : (
            <button disabled className="cursor-not-allowed w-full">
              <div className="bg-slate-300 text-slate-500 rounded-xl p-3 flex items-center gap-2.5 opacity-60">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><Package className="w-4 h-4" /></div>
                <div><p className="font-bold text-xs">Catalogue</p><p className="text-[10px]">produits</p></div>
              </div>
            </button>
          )}
        </div>

        {/* SECTION B — Top vendeurs */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-3">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-500" /> Classement des vendeurs</h3>
          </div>
          <div className="p-4">
            <Tabs defaultValue="week" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-3">
                <TabsTrigger value="week" className="text-xs">Cette semaine</TabsTrigger>
                <TabsTrigger value="month" className="text-xs">Ce mois</TabsTrigger>
                <TabsTrigger value="year" className="text-xs">Cette année</TabsTrigger>
              </TabsList>
              <TabsContent value="week"><TopVendeursSection data={topVendeurs?.topWeek} currentVendeurId={compteVendeur.id} /></TabsContent>
              <TabsContent value="month"><TopVendeursSection data={topVendeurs?.topMonth} currentVendeurId={compteVendeur.id} /></TabsContent>
              <TabsContent value="year"><TopVendeursSection data={topVendeurs?.topYear} currentVendeurId={compteVendeur.id} /></TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Commandes récentes */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-3">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 text-sm">Commandes récentes</h3>
            <Link to={createPageUrl("MesCommandesVendeur")}><span className="text-xs text-blue-600">Voir tout →</span></Link>
          </div>
          {(commandes || []).length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Aucune commande pour l'instant
            </div>
          ) : (
            commandes.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between p-4 border-b border-slate-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900 truncate">{c.produit_nom}</p>
                  <p className="text-xs text-slate-500">{c.client_nom} • {c.client_ville}</p>
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <Badge className={`${STATUTS[c.statut]?.couleur} text-xs border-0`}>{STATUTS[c.statut]?.label}</Badge>
                </div>
              </div>
            ))
          )}
        </div>

        {/* SECTION E — Transaction history */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-3">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 text-sm">📋 Historique des transactions</h3>
            <div className="flex gap-2 mt-3 flex-wrap">
              {[
                { key: "tout", label: "Tout" },
                { key: "commande", label: "Commandes" },
                { key: "vente", label: "Paiements" },
                { key: "paiement", label: "Retraits" },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setHistoryFilter(f.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${historyFilter === f.key ? 'bg-[#1a1f5e] text-white border-[#1a1f5e]' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Aucune transaction</div>
          ) : (
            filteredHistory.slice(0, 20).map((h, i) => (
              <div key={i} className="flex items-start gap-3 p-4 border-b border-slate-50 last:border-0">
                <span className="text-xl mt-0.5">{h.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-slate-900 truncate">{h.titre}</p>
                    <span className="text-xs text-slate-400 flex-shrink-0 ml-2">{formatRelativeTime(h.date)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{h.description}</p>
                  {h.montant > 0 && (
                    <p className="text-xs font-bold mt-1" style={{ color: h.color }}>{h.type === 'vente' ? '+' : ''}{formater(h.montant)}</p>
                  )}
                  {h.notes && <p className="text-xs text-slate-400 mt-1 italic">Note : {h.notes}</p>}
                  <p className="text-[10px] text-slate-300 mt-0.5">{new Date(h.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} à {new Date(h.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <VendeurBottomNav items={[
        { label: "Accueil", page: "EspaceVendeur" },
        { label: "Commandes", page: "MesCommandesVendeur", disabled: !canAccessFeature(compteVendeur.seller_status, "sales", compteVendeur.training_completed) },
        { label: "Catalogue", page: "CatalogueVendeur", disabled: !canAccessFeature(compteVendeur.seller_status, "catalog", compteVendeur.training_completed) },
        { label: "Profil", page: "ProfilVendeur", disabled: !canAccessFeature(compteVendeur.seller_status, "profile", compteVendeur.training_completed) },
        { label: "Aide", page: "AideVendeur" },
      ]} />
    </div>
  );
}
