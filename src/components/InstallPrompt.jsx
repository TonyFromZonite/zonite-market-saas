import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if already dismissed (7 day cooldown)
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    if (dismissed && Date.now() < parseInt(dismissed, 10)) return;

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    if (iOS) {
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setShowBanner(false);
      setIsInstalled(true);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem('pwa_install_dismissed', expiry.toString());
  };

  if (!showBanner || isInstalled) return null;

  if (isIOS) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-[9999] p-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}>
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 mx-auto max-w-md flex items-start gap-3">
          <img src="/logo.png" alt="Zonite" className="w-10 h-10 rounded-xl flex-shrink-0" loading="lazy" decoding="async" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">📲 Installer Zonite Market</p>
            <p className="text-xs text-slate-500 mt-1">
              Appuyez sur <span className="font-semibold">⬆️ Partager</span> puis{' '}
              <span className="font-semibold">"Sur l'écran d'accueil"</span> pour installer l'app.
            </p>
          </div>
          <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-600 flex-shrink-0 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] p-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}>
      <div className="bg-[#1a1f5e] rounded-2xl shadow-2xl p-4 mx-auto max-w-md">
        <div className="flex items-center gap-3 mb-3">
          <img src="/logo.png" alt="Zonite" className="w-10 h-10 rounded-xl flex-shrink-0" loading="lazy" decoding="async" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Zonite Market</p>
            <p className="text-xs text-white/60">Installer l'application</p>
          </div>
          <button onClick={handleDismiss} className="text-white/50 hover:text-white flex-shrink-0 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-white/70 mb-3">
          📲 Installez Zonite Market sur votre téléphone pour un accès rapide et une meilleure expérience.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleDismiss}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium text-white/70 bg-white/10 border-none cursor-pointer"
          >
            Plus tard
          </button>
          <button
            onClick={handleInstall}
            className="flex-[2] py-2.5 rounded-xl text-sm font-bold text-[#1a1f5e] border-none cursor-pointer flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #F5C518, #f5a623)' }}
          >
            <Download className="w-4 h-4" />
            Installer
          </button>
        </div>
      </div>
    </div>
  );
}
