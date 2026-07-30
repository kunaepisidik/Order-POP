import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NotificationRow = {
  id: number;
  target_role: "admin" | null;
  target_user_id: number | null;
  judul: string;
  pesan: string;
};

type PushSubscriptionRow = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function getNotificationUrl(notification: NotificationRow) {
  if (notification.target_role === "admin") return "/admin.html";
  return "/riwayat.html";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

    if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "Missing push notification secrets." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const { notificationId } = await request.json();
    if (!notificationId) {
      return new Response(JSON.stringify({ error: "notificationId is required." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: notification, error: notificationError } = await supabase
      .from("notifikasi")
      .select("id,target_role,target_user_id,judul,pesan")
      .eq("id", notificationId)
      .single<NotificationRow>();

    if (notificationError || !notification) {
      return new Response(JSON.stringify({ error: "Notification not found." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    let subscriptionQuery = supabase
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth");

    if (notification.target_role === "admin") {
      subscriptionQuery = subscriptionQuery.eq("target_role", "admin");
    } else {
      subscriptionQuery = subscriptionQuery.eq("user_id", notification.target_user_id);
    }

    const { data: subscriptions, error: subscriptionsError } = await subscriptionQuery
      .returns<PushSubscriptionRow[]>();

    if (subscriptionsError) {
      return new Response(JSON.stringify({ error: "Subscriptions failed to load." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const payload = JSON.stringify({
      title: notification.judul,
      body: notification.pesan,
      tag: `order-pop-${notification.id}`,
      url: getNotificationUrl(notification),
      icon: "/assets/logo/whatsapp.png",
      badge: "/assets/logo/whatsapp.png",
    });

    const results = await Promise.allSettled((subscriptions || []).map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        }, payload);
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
        }
        throw error;
      }
    }));

    const sent = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - sent;

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
