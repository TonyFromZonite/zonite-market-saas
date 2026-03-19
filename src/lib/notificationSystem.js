import { supabase } from "@/integrations/supabase/client";

class NotificationSystem {
  constructor() {
    this.audioCtx = null;
    this.unreadCount = 0;
    this.subscriptions = [];
  }

  initAudio() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }

  playSound() {
    try {
      if (!this.audioCtx) this.initAudio();
      if (this.audioCtx.state === "suspended") this.audioCtx.resume();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const t = this.audioCtx.currentTime;
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(660, t + 0.1);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    } catch (e) {}
  }

  async updateBadge(count) {
    this.unreadCount = count;
    try {
      if ("setAppBadge" in navigator) {
        count > 0 ? await navigator.setAppBadge(count) : await navigator.clearAppBadge();
      }
    } catch (e) {}
    document.title = count > 0 ? `(${count}) Zonite Market` : "Zonite Market";
  }

  async requestPermission() {
    try {
      if (!("Notification" in window)) return false;
      return (await Notification.requestPermission()) === "granted";
    } catch { return false; }
  }

  showPushNotification(title, body) {
    try {
      if (Notification.permission !== "granted") return;
      const notif = new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "zonite-" + Date.now(),
        renotify: true,
        vibrate: [200, 100, 200],
      });
      notif.onclick = () => { window.focus(); notif.close(); };
      setTimeout(() => notif.close(), 5000);
    } catch (e) {}
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
        if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
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
        if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
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
