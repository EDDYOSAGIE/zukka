import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { buildSectorNewsSnapshot } from "../services/openaiService";

type MerchantDashboardParams = {
  merchantId?: string;
};

type CreateDropBody = {
  caption?: string;
  hashtags?: string;
  media_url?: string;
  scheduled_for?: string | null;
  channel?: string;
};

type DashboardOrderRow = {
  id: string;
  amount_naira: number | string;
  payment_status: string;
  delivery_method: string;
  delivery_lga: string;
  created_at: string;
};

type DashboardDropRow = {
  id: string;
  caption: string;
  target_hashtag: string | null;
  media_url: string;
  status: string;
  published_at: string | null;
};

function toDashboardDrop(drop: DashboardDropRow) {
  return {
    id: drop.id,
    caption: drop.caption,
    hashtags: drop.target_hashtag ?? "",
    media: drop.media_url,
    scheduledFor: drop.published_at ?? "Queued",
    status: drop.status
  };
}

export async function getMerchantDashboard(req: Request<MerchantDashboardParams>, res: Response) {
  const merchantId = req.params.merchantId;

  if (!merchantId) {
    return res.status(400).json({
      error: "missing_merchant_context",
      message: "Merchant context is missing from the auth token."
    });
  }

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id,business_name,sector,zuka_trust_score")
    .eq("id", merchantId)
    .maybeSingle<{ id: string; business_name: string; sector: string | null; zuka_trust_score: number }>();

  if (merchantError || !merchant) {
    console.error("[dashboard.summary] Unable to resolve merchant profile.", merchantError);
    return res.status(404).json({
      error: "merchant_not_found",
      message: "The authenticated merchant could not be found."
    });
  }

  const [{ data: orders, error: ordersError }, { data: drops, error: dropsError }] = await Promise.all([
    supabase
      .from("orders")
      .select("id,amount_naira,payment_status,delivery_method,delivery_lga,created_at")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("scheduled_drops")
      .select("id,caption,target_hashtag,media_url,status,published_at")
      .eq("merchant_id", merchantId)
      .order("published_at", { ascending: false })
      .limit(6)
  ]);

  if (ordersError || dropsError) {
    console.error("[dashboard.summary] Failed to load dashboard data.", { ordersError, dropsError });
    return res.status(500).json({
      error: "dashboard_data_unavailable",
      message: "The merchant dashboard could not be loaded right now."
    });
  }

  const completedOrders = (orders ?? []).filter((order) => ["paid", "dispatched"].includes(order.payment_status));
  const gmv = completedOrders.reduce((sum, order) => sum + Number(order.amount_naira ?? 0), 0);
  const deliveryIntegrity = completedOrders.length > 0 ? "96%" : "94%";
  const sectorNews = buildSectorNewsSnapshot(merchant.sector ?? "general");

  return res.status(200).json({
    merchant: {
      id: merchant.id,
      business_name: merchant.business_name,
      sector: merchant.sector ?? "general",
      zuka_trust_score: merchant.zuka_trust_score
    },
    metrics: {
      gmv,
      completed_orders: completedOrders.length,
      delivery_integrity: deliveryIntegrity
    },
    recent_orders: (orders ?? []).slice(0, 5).map((order) => ({
      id: order.id,
      ref: order.id.slice(0, 8).toUpperCase(),
      amount_naira: Number(order.amount_naira ?? 0),
      payment_status: order.payment_status,
      delivery_method: order.delivery_method,
      delivery_lga: order.delivery_lga,
      created_at: order.created_at
    })),
    scheduled_drops: (drops ?? []).map(toDashboardDrop),
    sector_news: sectorNews
  });
}

export async function createMerchantDrop(req: Request<MerchantDashboardParams, object, CreateDropBody>, res: Response) {
  const merchantId = req.params.merchantId;
  const caption = req.body.caption?.trim();
  const hashtags = req.body.hashtags?.trim();
  const mediaUrl = req.body.media_url?.trim();
  const scheduledFor = req.body.scheduled_for ? req.body.scheduled_for.trim() : null;
  const channel = req.body.channel?.trim() ?? "instagram";

  if (!merchantId) {
    return res.status(400).json({
      error: "missing_merchant_context",
      message: "Merchant context is missing from the auth token."
    });
  }

  if (!caption || !mediaUrl) {
    return res.status(400).json({
      error: "missing_drop_fields",
      message: "caption and media_url are required to schedule a drop."
    });
  }

  const { data, error } = await supabase
    .from("scheduled_drops")
    .insert({
      merchant_id: merchantId,
      caption,
      target_hashtag: hashtags ?? null,
      media_url: mediaUrl,
      channel,
      status: "queued",
      published_at: scheduledFor ?? null
    })
    .select("id,caption,target_hashtag,media_url,status,published_at,channel")
    .single<DashboardDropRow>();

  if (error || !data) {
    console.error("[dashboard.drop] Failed to create scheduled drop.", error);
    return res.status(500).json({
      error: "drop_creation_failed",
      message: "The scheduled drop could not be saved."
    });
  }

  return res.status(201).json({ drop: toDashboardDrop(data) });
}
