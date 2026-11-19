import { supabase, TABLES } from "./supabaseClient.js";

const POLL_INTERVAL = 30000;
const VAPID_PUBLIC_KEY = "BN5noylugOGVc2wja92G-kQj_UQMqE5b8qTiWN_46Cb4lbfLAi2P9vyIzfg8X0T0DtNICn9x9tM9qsMPs9I0J8g";

function base64UrlToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

function getNotificationUrl(notification) {
  if (notification.target_role === "admin") return "admin.html";
  return "riwayat.html";
}

function getRecipient(user) {
  if (user.role === "admin") {
    return {
      storageKey: "orderPopLastNotificationAdmin",
      realtimeFilter: "target_role=eq.admin",
      apply(builder) {
        return builder.eq("target_role", "admin");
      },
    };
  }

  return {
    storageKey: `orderPopLastNotificationUser-${user.id}`,
    realtimeFilter: `target_user_id=eq.${user.id}`,
    apply(builder) {
      return builder.eq("target_user_id", user.id);
    },
  };
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;

  try {
    await navigator.serviceWorker.register("/service-worker.js");
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

async function showBrowserNotification(notification) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const title = notification.judul || "Order POP";
  const options = {
    body: notification.pesan || "",
    tag: `order-pop-${notification.id}`,
    renotify: true,
    icon: "assets/logo/whatsapp.png",
    badge: "assets/logo/whatsapp.png",
    data: {
      url: getNotificationUrl(notification),
    },
  };

  const registration = await registerServiceWorker();
  if (registration?.showNotification) {
    await registration.showNotification(title, options);
    return;
  }

  const browserNotification = new Notification(title, options);
  browserNotification.onclick = () => {
    window.focus();
    window.location.href = options.data.url;
  };
}

function createPermissionButton() {
  if (!("Notification" in window) || Notification.permission === "granted") return null;

  const button = document.createElement("button");
  button.className = "icon-btn notification-permission-btn";
  button.type = "button";
  button.textContent = Notification.permission === "denied" ? "Notifikasi Diblokir" : "Aktifkan Notifikasi";
  button.disabled = Notification.permission === "denied";

  const target = document.querySelector(".topbar-actions") || document.querySelector(".topbar, .admin-topbar");
  if (target) {
    target.appendChild(button);
  }

  return button;
}

export async function createNotification({ targetRole = null, targetUserId = null, orderId = null, title, message }) {
  const { data, error } = await supabase.from(TABLES.notifications).insert({
    target_role: targetRole,
    target_user_id: targetUserId,
    order_id: orderId,
    judul: title,
    pesan: message,
    dibaca: false,
  }).select("id").single();

  if (!error && data?.id) {
    await supabase.functions.invoke("send-push-notification", {
      body: { notificationId: data.id },
    }).catch(() => null);
  }

  return { error };
}

export function initBrowserNotifications(user, options = {}) {
  if (!user) return null;

  const recipient = getRecipient(user);
  const permissionButton = createPermissionButton();
  let lastSeenId = Number(localStorage.getItem(recipient.storageKey) || 0);

  async function savePushSubscription() {
    if (!("PushManager" in window)) return;

    const registration = await registerServiceWorker();
    if (!registration) return;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const subscriptionData = subscription.toJSON();
    await supabase
      .from(TABLES.pushSubscriptions)
      .upsert({
        user_id: user.role === "admin" ? null : user.id,
        target_role: user.role === "admin" ? "admin" : null,
        endpoint: subscription.endpoint,
        p256dh: subscriptionData.keys?.p256dh,
        auth: subscriptionData.keys?.auth,
        user_agent: navigator.userAgent,
      }, { onConflict: "endpoint" });
  }

  async function requestPermission() {
    if (!("Notification" in window)) return;

    const permission = await Notification.requestPermission();
    if (permissionButton) {
      permissionButton.textContent = permission === "granted" ? "Notifikasi Aktif" : "Notifikasi Diblokir";
      permissionButton.disabled = true;
    }

    if (permission === "granted") {
      await savePushSubscription();
      await showBrowserNotification({
        id: "test",
        judul: "Notifikasi Order POP Aktif",
        pesan: "Notifikasi akan muncul di status bar Chrome.",
      });
    }
  }

  async function loadNotifications({ showNew = false } = {}) {
    let query = supabase
      .from(TABLES.notifications)
      .select("*")
      .order("id", { ascending: false })
      .limit(10);

    query = recipient.apply(query);
    const { data, error } = await query;
    if (error || !data?.length) return;

    const newestId = Number(data[0].id);
    if (!lastSeenId) {
      lastSeenId = newestId;
      localStorage.setItem(recipient.storageKey, String(lastSeenId));
      return;
    }

    const newNotifications = data
      .filter((notification) => Number(notification.id) > lastSeenId)
      .sort((first, second) => Number(first.id) - Number(second.id));

    if (newNotifications.length === 0) return;

    lastSeenId = Math.max(...newNotifications.map((notification) => Number(notification.id)));
    localStorage.setItem(recipient.storageKey, String(lastSeenId));

    if (showNew) {
      for (const notification of newNotifications) {
        await showBrowserNotification(notification);
      }
      options.onNewNotification?.(newNotifications[newNotifications.length - 1]);
    }
  }

  permissionButton?.addEventListener("click", requestPermission);

  if ("Notification" in window && Notification.permission === "granted") {
    savePushSubscription();
  } else {
    registerServiceWorker();
  }

  loadNotifications();

  const channel = supabase
    .channel(`browser-notifikasi-${user.role}-${user.id}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: TABLES.notifications,
        filter: recipient.realtimeFilter,
      },
      async (payload) => {
        const notificationId = Number(payload.new.id);
        if (notificationId <= lastSeenId) return;

        lastSeenId = notificationId;
        localStorage.setItem(recipient.storageKey, String(lastSeenId));
        await showBrowserNotification(payload.new);
        options.onNewNotification?.(payload.new);
      },
    )
    .subscribe();

  const interval = window.setInterval(() => loadNotifications({ showNew: true }), POLL_INTERVAL);

  window.addEventListener("beforeunload", () => {
    window.clearInterval(interval);
    supabase.removeChannel(channel);
  });

  return {
    requestPermission,
    loadNotifications,
  };
}
