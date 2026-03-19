import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { filterTable, getCurrentUser } from "@/lib/supabaseHelpers";
import { supabase } from "@/integrations/supabase/client";
import { LOGO_URL } from "@/components/constants";
import { useToast } from "@/hooks/use-toast";

const getYoutubeEmbedUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  const cleaned = url.replace(/^"|"$/g, '').trim();
  if (!cleaned) return null;

  let videoId = null;
  try {
    const urlObj = new URL(cleaned);
    if (urlObj.hostname.includes('youtu.be')) {
      videoId = urlObj.pathname.slice(1).split('/')[0];
    } else if (urlObj.hostname.includes('youtube.com')) {
      if (urlObj.pathname.includes('/embed/')) {
        videoId = urlObj.pathname.split('/embed/')[1]?.split('?')[0]?.split('/')[0];
      } else if (urlObj.pathname.includes('/shorts/')) {
        videoId = urlObj.pathname.split('/shorts/')[1]?.split('?')[0];
      } else {
        videoId = urlObj.searchParams.get('v');
      }
    }
  } catch {
    const match = cleaned.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    videoId = match ? match[1] : null;
  }

  if (!videoId || videoId.length < 11) return null;
  videoId = videoId.substring(0, 11);
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
};

export default function VideoFormation() {
  const { toast } = useToast();
  const [compteVendeur, setCompteVendeur] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [erreur, setErreur] = useState("");
  const [confirmWatched, setConfirmWatched] = useState(false);
  const [acceptConditions, setAcceptConditions] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Timer state
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [timerDone, setTimerDone] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const timerRef = useRef(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    if (timerStarted) return;
    setTimerStarted(true);
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setTimerDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    let isMounted = true;
    const charger = async () => {
      try {
        const u = await getCurrentUser().catch(() => null);
        if (!u?.email) {
          if (isMounted) window.location.href = createPageUrl("Connexion");
          return;
        }

        // Get fresh seller data from DB
        const sellers = await filterTable("sellers", { email: u.email });
        if (!isMounted) return;
        if (sellers.length > 0) {
          const seller = sellers[0];
          setCompteVendeur(seller);

          // If already completed → redirect immediately, NEVER show formation again
          if (seller.catalogue_debloque && seller.training_completed) {
            navigate(createPageUrl("CatalogueVendeur"), { replace: true });
            return;
          }
        }

        // Load video URL
        const { data: configs } = await supabase
          .from("config_app")
          .select("cle, valeur")
          .in("cle", ["lien_youtube_formation", "formation_video_url"]);

        if (!isMounted) return;
        const configMap = {};
        (configs || []).forEach(c => { configMap[c.cle] = c.valeur; });
        const rawUrl = configMap["formation_video_url"] || configMap["lien_youtube_formation"] || "";
        const parsed = typeof rawUrl === "string" ? rawUrl.replace(/^"|"$/g, '') : String(rawUrl).replace(/^"|"$/g, '');

        if (parsed) {
          const embedUrl = getYoutubeEmbedUrl(parsed);
          if (embedUrl) setVideoUrl(embedUrl);
          else setErreur("Format vidéo invalide. Contactez l'administrateur.");
        } else {
          setErreur("Vidéo non configurée.");
        }
      } catch (err) {
        if (isMounted) {
          console.error("Chargement vidéo:", err);
          setErreur("Erreur réseau.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    charger();
    return () => { isMounted = false; };
  }, []);

  const handleTerminer = async () => {
    if (!confirmWatched || !acceptConditions || !compteVendeur?.id) return;
    setEnCours(true);
    setErreur("");
    try {
      const { error: updateError } = await supabase
        .from('sellers')
        .update({
          training_completed: true,
          catalogue_debloque: true,
          conditions_acceptees: true,
          training_completed_at: new Date().toISOString(),
        })
        .eq('id', compteVendeur.id);

      if (updateError) throw new Error(updateError.message);

      // Update session storage too
      const session = JSON.parse(sessionStorage.getItem('vendeur_session') || '{}');
      session.training_completed = true;
      session.catalogue_debloque = true;
      session.conditions_acceptees = true;
      sessionStorage.setItem('vendeur_session', JSON.stringify(session));

      toast({
        title: '🎉 Catalogue débloqué !',
        description: 'Vous avez accès à tous les produits.'
      });

      navigate(createPageUrl("CatalogueVendeur"), { replace: true });
    } catch (err) {
      console.error("Finalisation:", err);
      setErreur(err.message || "Erreur lors de la finalisation.");
    } finally {
      setEnCours(false);
    }
  };

  const canTerminer = confirmWatched && acceptConditions && timerDone;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1f5e] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1f5e]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 0px))" }}>
        <button
          onClick={() => navigate(createPageUrl("EspaceVendeur"))}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white">Formation Zonite Market</h1>
          <p className="text-xs text-white/60">Obligatoire pour accéder au catalogue</p>
        </div>
      </div>

      <div className="px-4 pb-8 max-w-lg mx-auto">
        {/* Description */}
        <div className="bg-white/10 rounded-xl p-4 mb-4">
          <p className="text-white/90 text-sm leading-relaxed">
            🎓 Bienvenue dans la formation Zonite Market ! Visionnez la vidéo complète pour débloquer l'accès au catalogue produits.
          </p>
        </div>

        {/* Video player */}
        <div className="rounded-2xl overflow-hidden mb-4 bg-black">
          {erreur && !videoUrl ? (
            <div className="aspect-video flex items-center justify-center flex-col gap-3 p-4">
              <AlertCircle className="w-10 h-10 text-yellow-400" />
              <p className="text-white text-center text-sm">{erreur}</p>
            </div>
          ) : videoUrl ? (
            <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', height: 0 }}>
              <iframe
                src={videoUrl}
                title="Formation ZONITE"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen={true}
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => {
                  setVideoLoaded(true);
                  startTimer();
                }}
                style={{
                  position: 'absolute',
                  top: 0, left: 0,
                  width: '100%', height: '100%',
                  border: 'none'
                }}
              />
            </div>
          ) : (
            <div className="aspect-video flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Visible countdown timer */}
        {videoLoaded && !timerDone && (
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-4">
            <div
              className="relative flex-shrink-0"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: `conic-gradient(#f5a623 ${(1 - secondsLeft / 30) * 360}deg, rgba(255,255,255,0.1) 0deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div className="w-9 h-9 rounded-full bg-[#1a1f5e] flex items-center justify-center text-sm font-bold text-[#f5a623]">
                {secondsLeft}
              </div>
            </div>
            <div>
              <p className="text-white text-sm font-semibold">Visionnez la formation</p>
              <p className="text-white/50 text-xs">
                Les cases à cocher se débloqueront dans {secondsLeft} seconde{secondsLeft > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}

        {timerDone && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl mb-4">
            <span className="text-xl">✅</span>
            <p className="text-emerald-400 text-sm font-semibold">
              Vidéo visionnée ! Cochez les cases ci-dessous pour continuer.
            </p>
          </div>
        )}

        {/* Checkboxes - only appear after 30s */}
        {timerDone && (
          <div className="bg-white/5 rounded-xl p-5 mb-6 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmWatched}
                onChange={(e) => setConfirmWatched(e.target.checked)}
                className="w-5 h-5 mt-0.5 accent-yellow-500 flex-shrink-0"
              />
              <span className="text-sm text-white/90 leading-relaxed">
                ✅ Je confirme avoir visionné la vidéo de formation Zonite Market dans son intégralité.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptConditions}
                onChange={(e) => setAcceptConditions(e.target.checked)}
                className="w-5 h-5 mt-0.5 accent-yellow-500 flex-shrink-0"
              />
              <span className="text-sm text-white/90 leading-relaxed">
                📋 J'accepte les conditions générales d'utilisation de Zonite Market et je m'engage à respecter les règles de la plateforme.
              </span>
            </label>
          </div>
        )}

        {/* Error */}
        {erreur && (
          <div className="flex items-center gap-2 p-3 bg-red-500/20 rounded-lg border border-red-400/30 mb-4">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{erreur}</p>
          </div>
        )}

        {/* Terminer button */}
        <button
          onClick={handleTerminer}
          disabled={!canTerminer || enCours}
          className="w-full py-4 rounded-xl text-base font-bold transition-all"
          style={{
            background: canTerminer
              ? 'linear-gradient(135deg, #f5a623, #e8940f)'
              : 'rgba(255,255,255,0.1)',
            color: canTerminer ? 'white' : 'rgba(255,255,255,0.3)',
            cursor: canTerminer ? 'pointer' : 'not-allowed',
            boxShadow: canTerminer ? '0 4px 15px rgba(245,166,35,0.4)' : 'none',
          }}
        >
          {enCours
            ? '⏳ Traitement en cours...'
            : canTerminer
              ? '🚀 Terminer et accéder au catalogue'
              : !timerDone
                ? `⏳ Patientez ${secondsLeft}s...`
                : '☑️ Cochez les cases pour continuer'
          }
        </button>
      </div>
    </div>
  );
}
