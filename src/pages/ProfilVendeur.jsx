import React, { useState, useEffect, useRef } from "react";
import { getVendeurSession, clearAllSessions } from "@/components/useSessionGuard";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import BadgeVendeur from "@/components/BadgeVendeur";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LogOut, ChevronLeft, User, Phone, MapPin, Wallet, TrendingUp, ShoppingBag, KeyRound, Eye, EyeOff, CheckCircle2, Copy, Share2, Pencil, Save, X, Facebook, MessageCircle, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOGO_URL as LOGO } from "@/components/constants";
import { useToast } from "@/hooks/use-toast";
import BanniereKycPending from "@/components/BanniereKycPending";
import PullToRefresh from "@/components/PullToRefresh";
import ProfileProgress from "@/components/vendor/ProfileProgress";

export default function ProfilVendeur() {
  const { toast } = useToast();
  const editSectionRef = useRef(null);
  const [compteVendeur, setCompteVendeur] = useState(null);
  const [nombreVentes, setNombreVentes] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [ouvrirChangeMdp, setOuvrirChangeMdp] = useState(false);
  const [ancienMdp, setAncienMdp] = useState("");
  const [nouveauMdp, setNouveauMdp] = useState("");
  const [confirmerMdp, setConfirmerMdp] = useState("");
  const [afficherMdp, setAfficherMdp] = useState(false);
  const [erreurMdp, setErreurMdp] = useState("");
  const [succesMdp, setSuccesMdp] = useState(false);
  const [saveMdpEnCours, setSaveMdpEnCours] = useState(false);

  // Edit profile state
  const [editingProfile, setEditingProfile] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [villes, setVilles] = useState([]);
  const [quartiers, setQuartiers] = useState([]);

  // Referral state
  const [editingCode, setEditingCode] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [codeAvailable, setCodeAvailable] = useState(null);
  const [checkingCode, setCheckingCode] = useState(false);

  // Referral data
  const [filleuls, setFilleuls] = useState([]);
  const [parrain, setParrain] = useState(null);
  const [socialConfigs, setSocialConfigs] = useState({});

  useEffect(() => {
    chargerDonnees();
  }, []);

  const chargerDonnees = async () => {
    const session = getVendeurSession();
    if (!session) {
      window.location.href = createPageUrl("Connexion");
      return;
    }

    const { data: authUser } = await supabase.auth.getUser();
    let seller = null;

    if (authUser?.user) {
      const { data } = await supabase.from('sellers').select('*').eq('user_id', authUser.user.id).maybeSingle();
      seller = data;
    }
    if (!seller && session.email) {
      const { data } = await supabase.from('sellers').select('*').eq('email', session.email).maybeSingle();
      seller = data;
    }

    if (seller) {
      setCompteVendeur(seller);

      // Ensure referral code exists
      if (!seller.code_parrainage) {
        const prefix = (seller.full_name || 'ZON').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase();
        const code = `${prefix}${seller.id?.slice(0, 4).toUpperCase() || '0000'}`;
        await supabase.from('sellers').update({ code_parrainage: code }).eq('id', seller.id);
        seller.code_parrainage = code;
        setCompteVendeur({ ...seller });
      }

      // Fetch sales count
      const { count } = await supabase.from('ventes').select('*', { count: 'exact', head: true }).eq('vendeur_id', seller.id);
      setNombreVentes(count || 0);

      // Fetch filleuls via SECURITY DEFINER RPC (bypasses RLS on sellers)
      const { data: filleulsData } = await supabase.rpc('get_filleuls_for_parrain', { _parrain_id: seller.id });
      setFilleuls(filleulsData || []);

      // Fetch my parrain info
      // First try parrainages table to get the code, then use RPC to get parrain info (bypasses RLS)
      const { data: myParrainage } = await supabase
        .from('parrainages')
        .select('code_parrainage')
        .eq('filleul_id', seller.id)
        .maybeSingle();

      const parrainCode = myParrainage?.code_parrainage || seller.parraine_par;
      if (parrainCode) {
        const { data: parrainData } = await supabase.rpc('validate_referral_code', { _code: parrainCode });
        const p = parrainData?.[0];
        if (p) {
          setParrain({ full_name: p.full_name, code_parrainage: parrainCode.toUpperCase() });
        }
      }
    }

    // Load social configs
    try {
      const { data: cfgData } = await supabase.from("config_app").select("cle, valeur");
      const map = {};
      (cfgData || []).forEach((i) => {
        try {
          const val = typeof i.valeur === "string" ? i.valeur : JSON.stringify(i.valeur);
          map[i.cle] = val.replace(/^"|"$/g, '');
        } catch { map[i.cle] = String(i.valeur || '').replace(/^"|"$/g, ''); }
      });
      setSocialConfigs(map);
    } catch (_) {}

    setChargement(false);
  };

  const formater = n => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

  const checkCodeAvailability = async (code) => {
    if (!code || code.length < 4) { setCodeAvailable(null); return; }
    setCheckingCode(true);
    try {
      const { data } = await supabase
        .from('sellers')
        .select('id')
        .eq('code_parrainage', code.toUpperCase())
        .neq('id', compteVendeur.id)
        .maybeSingle();
      setCodeAvailable(!data);
    } catch { setCodeAvailable(null); }
    finally { setCheckingCode(false); }
  };

  const saveReferralCode = async () => {
    if (!codeAvailable || !newCode) return;
    const cleaned = newCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    if (cleaned.length < 4) {
      toast({ title: '❌ Code trop court', description: 'Minimum 4 caractères', variant: 'destructive' });
      return;
    }
    await supabase.from('sellers').update({ code_parrainage: cleaned }).eq('id', compteVendeur.id);
    setCompteVendeur(prev => ({ ...prev, code_parrainage: cleaned }));
    toast({ title: '✅ Code mis à jour !', description: `Votre code est maintenant : ${cleaned}` });
    setEditingCode(false);
    setNewCode('');
    setCodeAvailable(null);
  };

  const referralLink = `https://zonite.org/InscriptionVendeur?ref=${compteVendeur?.code_parrainage || ''}`;

  const shareWhatsApp = () => {
    const msg =
      `🎉 Rejoins ZONITE Market !\n\n` +
      `Vends des produits sans stock.\n` +
      `Jusqu'à 50 000 FCFA/mois !\n\n` +
      `Mon code : *${compteVendeur?.code_parrainage}*\n` +
      `Lien : ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(referralLink);
    toast({ title: '✅ Lien copié !' });
  };

  const shareNative = async () => {
    const text =
      `🎉 Rejoins-moi sur ZONITE Market !\n` +
      `Vends des produits de qualité sans stock.\n` +
      `Inscris-toi avec mon code : *${compteVendeur?.code_parrainage}*\n\n` +
      referralLink;
    if (navigator.share) {
      try { await navigator.share({ title: 'Rejoins ZONITE Market', text, url: referralLink }); return; } catch {}
    }
    navigator.clipboard?.writeText(text);
    toast({ title: '✅ Lien copié !' });
  };

  const changerMotDePasse = async (e) => {
    e.preventDefault();
    setErreurMdp("");
    if (!ancienMdp || !nouveauMdp || !confirmerMdp) { setErreurMdp("Tous les champs sont requis."); return; }
    if (nouveauMdp.length < 8) { setErreurMdp("Minimum 8 caractères requis."); return; }
    if (!/[A-Z]/.test(nouveauMdp)) { setErreurMdp("Doit contenir au moins 1 majuscule."); return; }
    if (!/[0-9]/.test(nouveauMdp)) { setErreurMdp("Doit contenir au moins 1 chiffre."); return; }
    if (nouveauMdp !== confirmerMdp) { setErreurMdp("Les mots de passe ne correspondent pas."); return; }
    setSaveMdpEnCours(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nouveauMdp });
      if (error) {
        setErreurMdp(error.message || "Erreur lors du changement de mot de passe.");
      } else {
        setSuccesMdp(true);
        setAncienMdp(""); setNouveauMdp(""); setConfirmerMdp("");
        setTimeout(() => { clearAllSessions(); window.location.href = createPageUrl("Connexion"); }, 2500);
      }
    } catch { setErreurMdp("Erreur lors du changement de mot de passe."); }
  };

  const startEditingProfile = async () => {
    setEditFields({
      telephone: compteVendeur?.telephone || '',
      ville: compteVendeur?.ville || '',
      quartier: compteVendeur?.quartier || '',
      whatsapp: compteVendeur?.whatsapp || '',
      numero_mobile_money: compteVendeur?.numero_mobile_money || '',
      operateur_mobile_money: compteVendeur?.operateur_mobile_money || 'orange_money',
    });
    const { data: v } = await supabase.from('villes_cameroun').select('id, nom').eq('actif', true).order('nom');
    setVilles(v || []);
    if (compteVendeur?.ville) {
      const villeObj = (v || []).find(vi => vi.nom === compteVendeur.ville);
      if (villeObj) {
        const { data: q } = await supabase.from('quartiers').select('id, nom').eq('ville_id', villeObj.id).eq('actif', true).order('nom');
        setQuartiers(q || []);
      }
    }
    setEditingProfile(true);
    setTimeout(() => editSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleVilleChange = async (villeName) => {
    setEditFields(prev => ({ ...prev, ville: villeName, quartier: '' }));
    const villeObj = villes.find(v => v.nom === villeName);
    if (villeObj) {
      const { data: q } = await supabase.from('quartiers').select('id, nom').eq('ville_id', villeObj.id).eq('actif', true).order('nom');
      setQuartiers(q || []);
    } else {
      setQuartiers([]);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const updates = {
        telephone: editFields.telephone || null,
        ville: editFields.ville || null,
        quartier: editFields.quartier || null,
        whatsapp: editFields.whatsapp || null,
        numero_mobile_money: editFields.numero_mobile_money || null,
        operateur_mobile_money: editFields.operateur_mobile_money || 'orange_money',
      };
      const { error } = await supabase.from('sellers').update(updates).eq('id', compteVendeur.id);
      if (error) throw error;
      setCompteVendeur(prev => ({ ...prev, ...updates }));
      setEditingProfile(false);
      toast({ title: '✅ Profil mis à jour !' });
    } catch (err) {
      toast({ title: '❌ Erreur', description: err.message || 'Impossible de sauvegarder.', variant: 'destructive' });
    }
    setSavingProfile(false);
  };

  if (chargement) return (
    <div className="p-4 space-y-4">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
  );

  const displayName = compteVendeur?.full_name || "Vendeur";

  return (
    <PullToRefresh onRefresh={chargerDonnees}>
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-6">
      {compteVendeur?.seller_status === "kyc_pending" && <BanniereKycPending />}

      {/* Header */}
      <div className="bg-[#1a1f5e] text-white px-4 pb-8" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top, 0px))" }}>
        <div className="flex items-center gap-3 mb-4">
          <Link to={createPageUrl("EspaceVendeur")}><ChevronLeft className="w-6 h-6 text-white" /></Link>
          <img src={LOGO} alt="Zonite" className="h-7 w-7 rounded-lg object-contain bg-white p-0.5" />
          <h1 className="text-lg font-bold">Mon Profil</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#F5C518] rounded-2xl flex items-center justify-center text-[#1a1f5e] text-2xl font-bold">
            {displayName[0]?.toUpperCase() || "V"}
          </div>
          <div>
            <p className="font-bold text-lg">{displayName}</p>
            {compteVendeur?.username && <p className="text-slate-300 text-xs">@{compteVendeur.username}</p>}
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`text-xs border-0 ${compteVendeur?.seller_status === "active_seller" ? "bg-emerald-500 text-white" : "bg-yellow-500 text-white"}`}>
                {compteVendeur?.seller_status === "active_seller" ? "✓ Actif" : "En attente"}
              </Badge>
              <BadgeVendeur badge={compteVendeur?.badge_niveau || 'nouveau'} size="sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-4 -mt-5 space-y-3 sm:space-y-4 max-w-screen-md mx-auto w-full">
        {/* Profile Progress */}
        <ProfileProgress seller={compteVendeur} onEditProfile={startEditingProfile} />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Ventes", val: nombreVentes },
            { label: "Commissions", val: formater(compteVendeur?.total_commissions_gagnees) },
            { label: "Solde", val: formater(compteVendeur?.solde_commission) },
          ].map(({ label, val }) => (
            <div key={label} className="bg-white rounded-2xl p-3 shadow-sm text-center">
              <p className="font-bold text-slate-900 text-sm">{val}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Personal info */}
        <div ref={editSectionRef} className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900 text-sm">Informations personnelles</h2>
            {!editingProfile ? (
              <button onClick={startEditingProfile} className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:text-blue-700">
                <Pencil className="w-3.5 h-3.5" /> Modifier
              </button>
            ) : (
              <button onClick={() => setEditingProfile(false)} className="flex items-center gap-1 text-xs text-slate-400 font-medium hover:text-slate-600">
                <X className="w-3.5 h-3.5" /> Annuler
              </button>
            )}
          </div>

          {!editingProfile ? (
            <div className="space-y-3">
              {[
                { icone: User, label: "Nom", val: displayName },
                { icone: Phone, label: "Téléphone", val: compteVendeur?.telephone },
                { icone: MapPin, label: "Localisation", val: `${compteVendeur?.ville || ""}${compteVendeur?.quartier ? `, ${compteVendeur.quartier}` : ""}` },
                { icone: Phone, label: "WhatsApp", val: compteVendeur?.whatsapp },
                { icone: Wallet, label: "Mobile Money", val: `${compteVendeur?.numero_mobile_money || "—"} (${compteVendeur?.operateur_mobile_money === "orange_money" ? "Orange Money" : "MTN MoMo"})` },
              ].map(({ icone: Icone, label, val }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center"><Icone className="w-4 h-4 text-slate-500" /></div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="text-sm font-medium text-slate-900">{val || "—"}</p>
                  </div>
                  {(!val || val === "—" || val.startsWith("—")) && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">À compléter</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Téléphone */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Téléphone</label>
                <Input value={editFields.telephone} onChange={e => setEditFields(prev => ({ ...prev, telephone: e.target.value }))} placeholder="Ex: 690123456" />
              </div>
              {/* Ville */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Ville *</label>
                <Input value={editFields.ville} onChange={e => setEditFields(prev => ({ ...prev, ville: e.target.value }))} placeholder="Ex: Douala, Yaoundé..." />
              </div>
              {/* Quartier */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Quartier *</label>
                {quartiers.length > 0 ? (
                  <Select value={editFields.quartier} onValueChange={val => setEditFields(prev => ({ ...prev, quartier: val }))}>
                    <SelectTrigger><SelectValue placeholder="Choisir un quartier" /></SelectTrigger>
                    <SelectContent>
                      {quartiers.map(q => <SelectItem key={q.id} value={q.nom}>{q.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={editFields.quartier} onChange={e => setEditFields(prev => ({ ...prev, quartier: e.target.value }))} placeholder="Votre quartier" />
                )}
              </div>
              {/* WhatsApp */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Numéro WhatsApp</label>
                <Input value={editFields.whatsapp} onChange={e => setEditFields(prev => ({ ...prev, whatsapp: e.target.value }))} placeholder="Ex: 690123456" />
              </div>
              {/* Mobile Money */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Opérateur Mobile Money</label>
                <Select value={editFields.operateur_mobile_money} onValueChange={val => setEditFields(prev => ({ ...prev, operateur_mobile_money: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="orange_money">Orange Money</SelectItem>
                    <SelectItem value="mtn_momo">MTN MoMo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Numéro Mobile Money</label>
                <Input value={editFields.numero_mobile_money} onChange={e => setEditFields(prev => ({ ...prev, numero_mobile_money: e.target.value }))} placeholder="Ex: 690123456" />
              </div>
              {/* Save */}
              <Button onClick={saveProfile} disabled={savingProfile} className="w-full bg-[#1a1f5e] hover:bg-[#141952]">
                {savingProfile ? '⏳ Sauvegarde...' : '✅ Enregistrer les modifications'}
              </Button>
            </div>
          )}
        </div>

        {/* ═══════ REFERRAL CODE ═══════ */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-3 text-sm flex items-center gap-2">
            🔗 Mon code de parrainage
          </h2>

          {!editingCode ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 bg-gradient-to-r from-[#1a1f5e] to-[#2a2f7e] rounded-xl px-4 py-3 text-center">
                  <p className="text-amber-400 font-bold text-xl tracking-[3px]">{compteVendeur?.code_parrainage || '------'}</p>
                </div>
                <button
                  onClick={() => { setNewCode(compteVendeur?.code_parrainage || ''); setEditingCode(true); }}
                  className="px-3 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-200 transition-colors"
                >
                  ✏️
                </button>
              </div>

              {/* Share buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={shareWhatsApp} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-xs font-bold" style={{ background: '#25D366' }}>
                  💬 WhatsApp
                </button>
                <button onClick={copyLink} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-amber-600 text-xs font-bold bg-amber-50 border border-amber-200">
                  <Copy className="w-3.5 h-3.5" /> Copier lien
                </button>
                <button onClick={shareNative} className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-blue-600 text-xs font-bold bg-blue-50 border border-blue-200">
                  <Share2 className="w-3.5 h-3.5" /> Partager sur tous les réseaux
                </button>
              </div>
            </>
          ) : (
            <div>
              <p className="text-xs text-slate-400 mb-2">4 à 12 caractères, lettres et chiffres uniquement</p>
              <div className="relative mb-2">
                <Input
                  value={newCode}
                  onChange={e => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
                    setNewCode(val);
                    checkCodeAvailability(val);
                  }}
                  placeholder="Ex: JEAN237, MARIE2024"
                  maxLength={12}
                  className="text-center text-lg font-bold tracking-widest h-12"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-base">
                  {checkingCode ? '⏳' : newCode.length < 4 ? '' : codeAvailable === true ? '✅' : codeAvailable === false ? '❌' : ''}
                </div>
              </div>
              {newCode.length >= 4 && (
                <p className={`text-xs mb-2 ${codeAvailable === true ? 'text-emerald-600' : codeAvailable === false ? 'text-red-500' : 'text-slate-400'}`}>
                  {checkingCode ? 'Vérification...' : codeAvailable === true ? '✅ Ce code est disponible !' : codeAvailable === false ? '❌ Ce code est déjà pris.' : ''}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setEditingCode(false); setNewCode(''); setCodeAvailable(null); }}>Annuler</Button>
                <Button
                  className="flex-[2] bg-[#1a1f5e] hover:bg-[#141952]"
                  disabled={!codeAvailable || newCode.length < 4}
                  onClick={saveReferralCode}
                >
                  ✅ Sauvegarder
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ═══════ REFERRAL PROGRAM ═══════ */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-3 text-sm">🤝 Programme de Parrainage</h2>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <p className="text-xs font-semibold text-amber-800 mb-1">💰 Comment ça marche ?</p>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Partagez votre code → Votre filleul s'inscrit → Vous gagnez <strong>500 FCFA par livraison réussie</strong> de votre filleul, sur ses <strong>10 premières livraisons</strong> !
            </p>
          </div>

          {/* My parrain */}
          {parrain ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
              <p className="text-xs font-semibold text-blue-700 mb-2">👤 Mon parrain</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm">
                  {parrain.full_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{parrain.full_name}</p>
                  <p className="text-[11px] text-slate-400">Code : {parrain.code_parrainage}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-slate-200 rounded-xl p-3 mb-3 text-center">
              <p className="text-xs text-slate-400">Vous n'avez pas de parrain.</p>
            </div>
          )}

          {/* My filleuls */}
          <div className="mb-2">
            <p className="text-xs text-slate-500 font-semibold mb-2">👥 Mes filleuls ({filleuls.length})</p>
            {filleuls.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-slate-400">Aucun filleul pour l'instant.</p>
                <p className="text-[11px] text-slate-300 mt-1">Partagez votre code pour commencer à gagner !</p>
              </div>
            ) : (
              filleuls.slice(0, 10).map(f => {
                const isActive = f.seller_status === 'active_seller';
                return (
                  <div key={f.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {f.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{f.full_name}</p>
                      <p className="text-[11px] text-slate-400">{new Date(f.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <Badge className={`text-[10px] border-0 ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {isActive ? '✅ Actif' : '⏳ En attente'}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Account status */}
        <div className={`rounded-2xl p-4 shadow-sm ${compteVendeur?.statut_kyc === "rejete" ? "bg-red-50 border border-red-200" : "bg-white"}`}>
          <h2 className="font-semibold text-slate-900 mb-2 text-sm">Statut du compte</h2>
          <div className="space-y-2 text-sm">
            {[
              { label: "KYC", val: compteVendeur?.statut_kyc === "valide" ? "✓ Validé" : compteVendeur?.statut_kyc === "rejete" ? "✗ Rejeté" : "En attente", ok: compteVendeur?.statut_kyc === "valide" },
              { label: "Formation", val: compteVendeur?.training_completed ? "✓ Complétée" : "Non complétée", ok: compteVendeur?.training_completed },
              { label: "Catalogue", val: compteVendeur?.catalogue_debloque ? "✓ Débloqué" : "Verrouillé", ok: compteVendeur?.catalogue_debloque },
            ].map(({ label, val, ok }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-slate-500">{label}</span>
                <span className={`font-medium ${ok ? "text-emerald-600" : label === "KYC" && compteVendeur?.statut_kyc === "rejete" ? "text-red-600" : "text-yellow-600"}`}>{val}</span>
              </div>
            ))}
          </div>
          {compteVendeur?.statut_kyc === "rejete" && (
            <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-700">
              {compteVendeur?.kyc_raison_rejet || "Votre dossier KYC a été rejeté. Contactez le support."}
            </div>
          )}
        </div>

        {/* Change password */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => { setOuvrirChangeMdp(!ouvrirChangeMdp); setErreurMdp(""); setSuccesMdp(false); }}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center"><KeyRound className="w-4 h-4 text-blue-600" /></div>
              <span className="font-medium text-slate-900 text-sm">Changer mon mot de passe</span>
            </div>
            <span className="text-slate-400 text-xs">{ouvrirChangeMdp ? "▲" : "▼"}</span>
          </button>
          {ouvrirChangeMdp && (
            <div className="px-4 pb-4">
              {succesMdp ? (
                <div className="flex items-center gap-2 bg-emerald-50 rounded-xl p-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <p className="text-emerald-700 text-sm font-medium">Mot de passe changé avec succès !</p>
                </div>
              ) : (
                <form onSubmit={changerMotDePasse} className="space-y-3">
                  {[
                    { label: "Ancien mot de passe", val: ancienMdp, setter: setAncienMdp },
                    { label: "Nouveau mot de passe", val: nouveauMdp, setter: setNouveauMdp },
                    { label: "Confirmer le nouveau", val: confirmerMdp, setter: setConfirmerMdp },
                  ].map(({ label, val, setter }) => (
                    <div key={label}>
                      <label className="text-xs text-slate-500 block mb-1">{label}</label>
                      <div className="relative">
                        <Input type={afficherMdp ? "text" : "password"} value={val} onChange={(e) => setter(e.target.value)} placeholder="••••••••" className="h-10 pr-10" />
                        <button type="button" onClick={() => setAfficherMdp(!afficherMdp)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                          {afficherMdp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  {erreurMdp && <p className="text-red-500 text-xs">{erreurMdp}</p>}
                  <Button type="submit" disabled={saveMdpEnCours} className="w-full bg-[#1a1f5e] hover:bg-[#141952] h-10 text-sm">
                    {saveMdpEnCours ? "Enregistrement..." : "Mettre à jour le mot de passe"}
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Payment button */}
        {(compteVendeur?.solde_commission || 0) >= 5000 && (
          <Link to={createPageUrl("DemandePaiement")}>
            <Button className="w-full bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1f5e] font-bold">
              Demander un paiement → {formater(compteVendeur?.solde_commission)}
            </Button>
          </Link>
        )}

        {/* Rejoindre la communauté */}
        {(socialConfigs["lien_facebook"] || socialConfigs["lien_tiktok"] || socialConfigs["lien_whatsapp"]) && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#1a1f5e]" />
              <h3 className="font-semibold text-slate-900 text-sm">Rejoindre la communauté Zonite</h3>
            </div>
            <div className="p-4 flex flex-row gap-2.5">
              {socialConfigs["lien_whatsapp"] && (
                <a href={socialConfigs["lien_whatsapp"]} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] font-semibold text-xs active:scale-[0.97] transition-transform">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </a>
              )}
              {socialConfigs["lien_facebook"] && (
                <a href={socialConfigs["lien_facebook"]} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-[#1877F2]/10 border border-[#1877F2]/20 text-[#1877F2] font-semibold text-xs active:scale-[0.97] transition-transform">
                  <Facebook className="w-[22px] h-[22px]" /> Facebook
                </a>
              )}
              {socialConfigs["lien_tiktok"] && (
                <a href={socialConfigs["lien_tiktok"]} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-xs active:scale-[0.97] transition-transform">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.77a4.85 4.85 0 01-1.01-.08z"/></svg>
                  TikTok
                </a>
              )}
            </div>
          </div>
        )}

        {/* Logout */}
        <Button variant="outline" onClick={() => { clearAllSessions(); supabase.auth.signOut(); window.location.href = createPageUrl("Connexion"); }} className="w-full border-red-200 text-red-600 hover:bg-red-50">
          <LogOut className="w-4 h-4 mr-2" /> Se déconnecter
        </Button>
      </div>
    </div>
    </PullToRefresh>
  );
}
