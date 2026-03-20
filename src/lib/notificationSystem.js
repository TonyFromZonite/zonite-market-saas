import { supabase } from "@/integrations/supabase/client";

const BADGE_KEY = 'zonite_unread_count';

const saveBadgeCount = (count) => {
  localStorage.setItem(BADGE_KEY, String(Math.max(0, count)));
};

const getSavedBadgeCount = () => {
  return parseInt(localStorage.getItem(BADGE_KEY) || '0');
};

class NotificationSystem {
  constructor() {
    this.audioCtx = null;
    this.unreadCount = getSavedBadgeCount();
    this.subscriptions = [];
  }

  initAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    } catch (e) {}
  }

  playSound() {
    try {
      if (!this.audioCtx) this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const t = this.audioCtx.currentTime;

      // Note 1: high ping
      const gain1 = this.audioCtx.createGain();
      gain1.connect(this.audioCtx.destination);
      gain1.gain.setValueAtTime(1.0, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      const osc1 = this.audioCtx.createOscillator();
      osc1.connect(gain1);
      osc1.frequency.setValueAtTime(1046, t);
      osc1.frequency.setValueAtTime(1318, t + 0.08);
      osc1.start(t);
      osc1.stop(t + 0.35);

      // Note 2: second ping
      const gain2 = this.audioCtx.createGain();
      gain2.connect(this.audioCtx.destination);
      gain2.gain.setValueAtTime(0, t + 0.12);
      gain2.gain.setValueAtTime(1.0, t + 0.13);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      const osc2 = this.audioCtx.createOscillator();
      osc2.connect(gain2);
      osc2.frequency.setValueAtTime(1318, t + 0.12);
      osc2.start(t + 0.12);
      osc2.stop(t + 0.45);
    } catch (e) {
      console.error('Sound error:', e);
    }
  }

  async updateBadge(count) {
    const safeCount = Math.max(0, count);
    this.unreadCount = safeCount;
    saveBadgeCount(safeCount);

    try {
      if ('setAppBadge' in navigator) {
        if (safeCount > 0) {
          await navigator.setAppBadge(safeCount);
        } else {
          await navigator.clearAppBadge();
        }
      }
    } catch (e) {}

    document.title = safeCount > 0 ? `(${safeCount}) Zonite Market` : 'Zonite Market';
  }

  async requestPermission() {
    try {
      if (!('Notification' in window)) return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setTimeout(() => {
          this.showPushNotification(
            '✅ Notifications activées !',
            'Vous recevrez des alertes sonores pour vos commandes.'
          );
          this.playSound();
        }, 500);
      }
      return permission === 'granted';
    } catch { return false; }
  }

  showPushNotification(title, body) {
    try {
      if (Notification.permission !== 'granted') return;
      const notif = new Notification(title, {
        body: body || '',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `zonite-${Date.now()}`,
        renotify: true,
        silent: false,
        vibrate: [300, 100, 300, 100, 300],
        requireInteraction: true,
        timestamp: Date.now(),
      });
      notif.onclick = () => { window.focus(); notif.close(); };
    } catch (e) {
      console.error('Push notification error:', e);
    }
  }

  subscribeVendeur(vendeurId, callback) {
    const sub = supabase
      .channel(`notifs_vendeur_${vendeurId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications_vendeur",
        filter: `vendeur_id=eq.${vendeurId}`,
      }, (payload) => {
        const notif = payload.new;
        this.playSound();
        if ("vibrate" in navigator) navigator.vibrate([300, 100, 300, 100, 300]);
        this.updateBadge(this.unreadCount + 1);
        this.showPushNotification(notif.titre, notif.message?.slice(0, 80));
        if (callback) callback(notif);
      })
      .subscribe();
    this.subscriptions.push(sub);
    return sub;
  }

  subscribeAdmin(callback) {
    const sub = supabase
      .channel("notifs_admin_rt")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications_admin",
      }, (payload) => {
        const notif = payload.new;
        this.playSound();
        if ("vibrate" in navigator) navigator.vibrate([300, 100, 300, 100, 300]);
        this.updateBadge(this.unreadCount + 1);
        this.showPushNotification(notif.titre, notif.message?.slice(0, 80));
        if (callback) callback(notif);
      })
      .subscribe();
    this.subscriptions.push(sub);
    return sub;
  }

  unsubscribeAll() {
    this.subscriptions.forEach((sub) => supabase.removeChannel(sub));
    this.subscriptions = [];
  }
}

export const notifSystem = new NotificationSystem();
