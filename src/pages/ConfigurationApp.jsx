import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Facebook, Globe, MessageCircle, Lock, Youtube, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";

const CONFIGS = [
  { cle: "nom_app", label: "Nom de l'application", placeholder: "Zonite Market", icone: Globe, couleur: "text-[#1a1f5e]" },
  { cle: "message_accueil", label: "Message de bienvenue (page connexion)", placeholder: "Chaque vente est une victoire. Allons-y ! 🚀", icone: MessageCircle, couleur: "text-emerald-600" },
  { cle: "lien_youtube_formation", label: "URL Vidéo de formation YouTube (obligatoire)", placeholder: "https://www.youtube.com/watch?v=...", icone: Youtube, couleur: "text-red-600" },
  { cle: "lien_facebook", label: "Lien Facebook", placeholder: "https://facebook.com/votrepage", icone: Facebook, couleur: "text-blue-600" },
  { cle: "lien_tiktok", label: "Lien TikTok", placeholder: "https://tiktok.com/@votrecompte", icone: Globe, couleur: "text-slate-700" },
  { cle: "lien_whatsapp", label: "Lien WhatsApp (groupe ou page)", placeholder: "https://chat.whatsapp.com/... ou https://wa.me/...", icone: MessageCircle, couleur: "text-[#25D366]" },
];

export default function ConfigurationApp() {
  const [valeurs, setValeurs] = useState({});
  const [ids, setIds] = useState({});
  const [chargement, setChargement] = useState(false);
  const [succes, setSucces] = useState(false);
  const { toast } = useToast();

  // Formation videos state
  const [videos, setVideos] = useState([]);
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [newVideo, setNewVideo] = useState({ titre: "", description: "", youtube_url: "" });
  const [savingVideo, setSavingVideo] = useState(false);

  useEffect(() => {
    const charger = async () => {
      const { data: items, error } = await supabase
        .from("config_app")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) { console.error("Chargement config:", error); return; }
      const map = {};
      const idMap = {};
      (items || []).forEach((i) => {
        map[i.cle] = typeof i.valeur === "string" ? i.valeur : JSON.stringify(i.valeur).replace(/^"|"$/g, '');
        idMap[i.cle] = i.id;
      });
      setValeurs(map);
      setIds(idMap);
    };
    charger();
    loadVideos();
  }, []);

  const loadVideos = async () => {
    const { data } = await supabase
      .from("formation_videos")
      .select("*")
      .order("ordre", { ascending: true });
    setVideos(data || []);
  };

  const sauvegarder = async () => {
    setChargement(true);
    setSucces(false);
    try {
      for (const { cle } of CONFIGS) {
        const valeur = valeurs[cle] || "";
        if (ids[cle]) {
          await supabase.from("config_app").update({ valeur }).eq("id", ids[cle]);
        } else if (valeur) {
          const { data } = await supabase.from("config_app").insert({ cle, valeur }).select().single();
          if (data) setIds((prev) => ({ ...prev, [cle]: data.id }));
        }
      }
      setSucces(true);
      setTimeout(() => setSucces(false), 3000);
    } catch (err) {
      console.error("Sauvegarde config:", err);
    }
    setChargement(false);
  };

  const saveVideo = async () => {
    if (!newVideo.titre || !newVideo.description || !newVideo.youtube_url) {
      toast({ title: "⚠️ Champs obligatoires", description: "Titre, description et URL YouTube requis", variant: "destructive" });
      return;
    }
    setSavingVideo(true);
    const { error } = await supabase.from("formation_videos").insert({
      titre: newVideo.titre,
      description: newVideo.description,
      youtube_url: newVideo.youtube_url,
      ordre: videos.length + 1,
      actif: true,
    });
    setSavingVideo(false);
    if (!error) {
      toast({ title: "✅ Vidéo ajoutée !" });
      setNewVideo({ titre: "", description: "", youtube_url: "" });
      setShowAddVideo(false);
      loadVideos();
    } else {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  };

  const deleteVideo = async (id) => {
    if (!confirm("Supprimer cette vidéo ?")) return;
    await supabase.from("formation_videos").delete().eq("id", id);
    loadVideos();
  };

  const toggleVideoStatus = async (id, actif) => {
    await supabase.from("formation_videos").update({ actif: !actif }).eq("id", id);
    loadVideos();
  };

  const moveVideo = async (id, direction) => {
    const index = videos.findIndex(v => v.id === id);
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === videos.length - 1) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    await Promise.all([
      supabase.from("formation_videos").update({ ordre: videos[swapIndex].ordre }).eq("id", id),
      supabase.from("formation_videos").update({ ordre: videos[index].ordre }).eq("id", videos[swapIndex].id),
    ]);
    loadVideos();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Configuration de l'Application</h2>
        <p className="text-sm text-slate-500">Personnalisez les liens réseaux sociaux et les textes affichés sur la page de connexion.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        {CONFIGS.map(({ cle, label, placeholder, icone: Icone, couleur }) => (
          <div key={cle}>
            <Label className="flex items-center gap-2 mb-1.5">
              <Icone className={`w-4 h-4 ${couleur}`} />
              {label}
            </Label>
            <Input
              value={valeurs[cle] || ""}
              onChange={(e) => setValeurs({ ...valeurs, [cle]: e.target.value })}
              placeholder={placeholder}
            />
            {cle === "lien_youtube_formation" && (
              <p className="text-xs text-slate-500 mt-1">💡 Collez l'URL complète YouTube (ex: https://www.youtube.com/watch?v=VIDEO_ID ou https://youtu.be/VIDEO_ID)</p>
            )}
          </div>
        ))}

        <div className="pt-2 flex items-center gap-3">
          <Button onClick={sauvegarder} disabled={chargement} className="bg-[#1a1f5e] hover:bg-[#141952]">
            <Save className="w-4 h-4 mr-2" />
            {chargement ? "Enregistrement..." : "Sauvegarder"}
          </Button>
          {succes && <span className="text-emerald-600 text-sm font-medium">✓ Modifications enregistrées</span>}
        </div>
      </div>

      {/* Aperçu */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Aperçu page de connexion</p>
        <div className="flex gap-3 flex-wrap">
          {valeurs["lien_facebook"] && (
            <a href={valeurs["lien_facebook"]} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 text-blue-700 text-sm font-medium">
              <Facebook className="w-4 h-4" /> Facebook
            </a>
          )}
          {valeurs["lien_tiktok"] && (
            <a href={valeurs["lien_tiktok"]} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 text-sm font-medium">
              TikTok
            </a>
          )}
          {valeurs["lien_telegram"] && (
            <a href={valeurs["lien_telegram"]} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-xl px-3 py-1.5 text-sky-700 text-sm font-medium">
              <Send className="w-3.5 h-3.5" /> Telegram
            </a>
          )}
        </div>
        {valeurs["message_accueil"] && (
          <p className="mt-3 text-sm text-slate-600 italic">"{valeurs["message_accueil"]}"</p>
        )}
      </div>

      {/* ═══ FORMATION & COURS ═══ */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#f5a623]" />
            <h3 className="font-bold text-slate-900">🎓 Formation & Cours Zonite Market</h3>
          </div>
          <Button onClick={() => setShowAddVideo(true)} className="bg-[#f5a623] hover:bg-[#e8940f] text-white text-xs">
            + Ajouter une vidéo
          </Button>
        </div>

        {videos.length === 0 ? (
          <p className="text-slate-400 text-center py-6 text-sm">
            Aucune vidéo de formation. Ajoutez votre première vidéo.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {videos.map((video, index) => (
              <div key={video.id} className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 flex-wrap border border-slate-100">
                {/* Order buttons */}
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveVideo(video.id, "up")} disabled={index === 0}
                    className={`text-xs px-1 ${index === 0 ? "text-slate-300 cursor-not-allowed" : "text-slate-600 hover:text-slate-900 cursor-pointer"}`}>▲</button>
                  <button onClick={() => moveVideo(video.id, "down")} disabled={index === videos.length - 1}
                    className={`text-xs px-1 ${index === videos.length - 1 ? "text-slate-300 cursor-not-allowed" : "text-slate-600 hover:text-slate-900 cursor-pointer"}`}>▼</button>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900 truncate">{video.titre}</div>
                  <div className="text-xs text-slate-500 truncate max-w-[250px]">{video.description}</div>
                </div>
                {/* Status */}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${video.actif ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                  {video.actif ? "Visible" : "Masquée"}
                </span>
                {/* Actions */}
                <div className="flex gap-1.5">
                  <button onClick={() => toggleVideoStatus(video.id, video.actif)}
                    className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs cursor-pointer">
                    {video.actif ? "🙈 Masquer" : "👁️ Afficher"}
                  </button>
                  <button onClick={() => deleteVideo(video.id)}
                    className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-xs cursor-pointer">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Video Modal */}
        {showAddVideo && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-bold text-slate-900">+ Ajouter une vidéo</h3>
                <button onClick={() => setShowAddVideo(false)} className="text-slate-400 hover:text-slate-600 text-xl cursor-pointer">×</button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-slate-600 mb-1">Titre de la vidéo *</Label>
                  <Input placeholder="Ex: Comment créer une commande" value={newVideo.titre}
                    onChange={e => setNewVideo(p => ({ ...p, titre: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-sm text-slate-600 mb-1">Description *</Label>
                  <textarea placeholder="Décrivez ce que les vendeurs vont apprendre..."
                    value={newVideo.description} onChange={e => setNewVideo(p => ({ ...p, description: e.target.value }))}
                    rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-vertical" />
                </div>
                <div>
                  <Label className="text-sm text-slate-600 mb-1">Lien YouTube *</Label>
                  <Input placeholder="https://www.youtube.com/watch?v=..." value={newVideo.youtube_url}
                    onChange={e => setNewVideo(p => ({ ...p, youtube_url: e.target.value }))} />
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800 font-semibold mb-1">⚠️ Vidéos privées YouTube</p>
                    <p className="text-xs text-amber-700">Les vidéos <strong>privées</strong> ne peuvent PAS être lues sur d'autres sites. Utilisez des vidéos <strong>publiques</strong> ou <strong>non répertoriées</strong> (unlisted).</p>
                    <p className="text-xs text-amber-600 mt-1">YouTube Studio → Vidéo → Visibilité → "Non répertoriée"</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <Button variant="outline" className="flex-1" onClick={() => setShowAddVideo(false)}>Annuler</Button>
                <Button className="flex-[2] bg-[#f5a623] hover:bg-[#e8940f] text-white" onClick={saveVideo} disabled={savingVideo}>
                  {savingVideo ? "⏳ Ajout..." : "✅ Ajouter la vidéo"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sécurité Admin */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#1a1f5e]" />
            <div>
              <p className="font-bold text-slate-900">Sécurité Administrateur</p>
              <p className="text-sm text-slate-500">Configurez votre mot de passe pour l'accès mobile</p>
            </div>
          </div>
          <Link to={createPageUrl("ConfigurationAdminPassword")}>
            <Button className="bg-[#1a1f5e] hover:bg-[#141952]">Gérer mot de passe →</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
