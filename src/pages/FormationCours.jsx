import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import VendeurBottomNav from "@/components/VendeurBottomNav";

const getEmbedUrl = (url) => {
  if (!url) return null;
  let videoId = null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      videoId = u.pathname.slice(1).split("?")[0];
    } else if (u.hostname.includes("youtube.com")) {
      if (u.pathname.includes("/shorts/")) {
        videoId = u.pathname.split("/shorts/")[1]?.split("?")[0];
      } else if (u.pathname.includes("/embed/")) {
        videoId = u.pathname.split("/embed/")[1]?.split("?")[0];
      } else {
        videoId = u.searchParams.get("v");
      }
    }
  } catch {
    const m = url.match(/[?&]v=([^&]+)/);
    videoId = m ? m[1] : null;
  }
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
};

export default function FormationCours() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("formation_videos")
        .select("*")
        .eq("actif", true)
        .order("ordre", { ascending: true });
      setVideos(data || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
      </div>
    );
  }

  // VIDEO PLAYER VIEW
  if (selectedVideo) {
    const embedUrl = getEmbedUrl(selectedVideo.youtube_url);
    return (
      <div className="min-h-screen bg-[#1a1f4e] text-white pb-24">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 bg-black/20"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 0px))" }}>
          <button
            onClick={() => setSelectedVideo(null)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold truncate">{selectedVideo.titre}</h1>
        </div>

        <div className="max-w-[800px] mx-auto px-4 py-6">
          <div className="relative w-full rounded-xl overflow-hidden bg-black mb-5" style={{ paddingBottom: "56.25%" }}>
            {embedUrl ? (
              <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full border-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
                ❌ URL vidéo invalide
              </div>
            )}
          </div>

          <div className="bg-white/5 rounded-xl p-4 mb-6">
            <h2 className="text-lg font-bold mb-2">{selectedVideo.titre}</h2>
            <p className="text-white/70 text-sm leading-relaxed">{selectedVideo.description}</p>
          </div>

          {videos.length > 1 && (
            <div>
              <h3 className="text-[#f5a623] text-sm font-semibold mb-3">🎓 Autres formations</h3>
              <div className="flex flex-col gap-2">
                {videos.filter(v => v.id !== selectedVideo.id).map(video => (
                  <div
                    key={video.id}
                    onClick={() => setSelectedVideo(video)}
                    className="bg-white/5 rounded-xl p-3 cursor-pointer flex items-center gap-3 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <div className="w-10 h-10 bg-[#f5a623] rounded-lg flex items-center justify-center text-lg flex-shrink-0">▶</div>
                    <div className="min-w-0">
                      <div className="text-white font-semibold text-sm truncate">{video.titre}</div>
                      <div className="text-white/50 text-xs mt-0.5 truncate">{video.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // VIDEOS LIST VIEW
  return (
    <div className="min-h-screen bg-[#1a1f4e] text-white pb-24">
      <div className="px-4 py-5 border-b border-white/10"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top, 0px))" }}>
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => navigate(createPageUrl("EspaceVendeur"))}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">🎓 Formation & Cours</h1>
            <p className="text-white/50 text-xs">Apprenez à utiliser Zonite Market</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-[800px] mx-auto">
        {videos.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <div className="text-5xl mb-3">🎓</div>
            <p>Aucune formation disponible pour le moment.</p>
            <p className="text-sm mt-1">Revenez bientôt !</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {videos.map((video, index) => (
              <div
                key={video.id}
                className="bg-white/5 rounded-2xl overflow-hidden border border-white/10"
              >
                <div
                  className="w-full h-40 flex items-center justify-center relative"
                  style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.2), rgba(26,31,78,0.8))" }}
                >
                  <div className="w-16 h-16 bg-[#f5a623]/90 rounded-full flex items-center justify-center text-2xl text-white">▶</div>
                  <div className="absolute top-3 left-3 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-semibold">
                    Cours #{index + 1}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-white text-base font-bold mb-2">{video.titre}</h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-4">{video.description}</p>
                  <button
                    onClick={() => setSelectedVideo(video)}
                    className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, #f5a623, #e8940f)" }}
                  >
                    ▶ Regarder ce cours
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
    </div>
  );
}
