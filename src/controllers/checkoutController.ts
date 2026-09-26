import crypto from "node:crypto";
import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { authenticateToken } from "../middleware/auth";
import { dispatchMetaMessage } from "./metaController";
import { initializePaystackTransaction } from "../services/paystackService";

type CreateCheckoutBody = {
  item_id?: string;
  customer_phone?: string;
  amount_naira?: number;
  payment_method?: "transfer" | "bnpl";
  delivery_method?: "express" | "eco_pool";
  delivery_lga?: string;
  social_channel?: "instagram" | "whatsapp";
  external_user_id?: string;
};

type AuthenticatedCheckoutParams = {
  merchantId?: string;
  [key: string]: string | undefined;
};

type CheckoutOrderRow = {
  id: string;
  merchant_id: string;
  item_id: string | null;
  customer_phone: string;
  amount_naira: number | string;
  payment_method: "transfer" | "bnpl";
  payment_status: "pending" | "paid" | "failed_requires_refund";
  paystack_reference: string | null;
  delivery_method: "express" | "eco_pool";
  delivery_lga: string;
  checkout_url: string | null;
};

function getPublicAppUrl(): string {
  return (process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
}

function createPaystackReference(): string {
  return `zuka_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

function buildCheckoutUrl(orderId: string, reference: string): string {
  const url = new URL("/checkout", getPublicAppUrl());
  url.searchParams.set("order_id", orderId);
  url.searchParams.set("reference", reference);
  return url.toString();
}

function getMerchantId(req: Request<AuthenticatedCheckoutParams>): string | undefined {
  return req.params.merchantId;
}

async function recordOutboundCheckoutMessage(
  order: CheckoutOrderRow,
  channel: "instagram" | "whatsapp" | undefined,
  externalUserId: string | undefined,
  checkoutUrl: string
): Promise<void> {
  if (!channel || !externalUserId) {
    return;
  }

  const messageText = `Your Zuka checkout link is ready: ${checkoutUrl}`;

  const { error } = await supabase.from("chat_logs").insert({
    merchant_id: order.merchant_id,
    platform: channel,
    external_user_id: externalUserId,
    user_handle: externalUserId,
    message_text: messageText,
    direction: "outbound",
    sentiment_flag: "checkout_link_sent"
  });

  if (error) {
    console.error(`[checkout.create] Failed to record outbound checkout link for order ${order.id}.`, error);
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("meta_page_access_token")
    .eq("id", order.merchant_id)
    .maybeSingle<{ meta_page_access_token: string | null }>();

  await dispatchMetaMessage({
    platform: channel,
    recipientId: externalUserId,
    messageText,
    accessToken: merchant?.meta_page_access_token
  });
}

export const checkoutRoutes = {
  authenticateToken,

  async createCheckoutOrder(req: Request<AuthenticatedCheckoutParams, object, CreateCheckoutBody>, res: Response) {
    console.log("[checkout.create] Creating social commerce checkout order.");

    const merchantId = getMerchantId(req);
    const {
      item_id,
      customer_phone,
      amount_naira,
      payment_method = "transfer",
      delivery_method,
      delivery_lga,
      social_channel,
      external_user_id
    } = req.body;

    if (!merchantId || !customer_phone || !amount_naira || !delivery_method || !delivery_lga) {
      return res.status(400).json({
        error: "missing_checkout_fields",
        message: "customer_phone, amount_naira, delivery_method, and delivery_lga are required."
      });
    }

    if (!["express", "eco_pool"].includes(delivery_method)) {
      return res.status(400).json({
        error: "invalid_delivery_method",
        message: "delivery_method must be express or eco_pool."
      });
    }

    const paystackReference = createPaystackReference();

    const { data: insertedOrder, error: insertError } = await supabase
      .from("orders")
      .insert({
        merchant_id: merchantId,
        item_id: item_id ?? null,
        customer_phone,
        amount_naira,
        payment_method,
        payment_status: "pending",
        paystack_reference: paystackReference,
        delivery_method,
        delivery_lga
      })
      .select(
        "id,merchant_id,item_id,customer_phone,amount_naira,payment_method,payment_status,paystack_reference,delivery_method,delivery_lga,checkout_url"
      )
      .single<CheckoutOrderRow>();

    if (insertError || !insertedOrder) {
      console.error("[checkout.create] Failed to create checkout order.", insertError);
      return res.status(500).json({
        error: "checkout_order_creation_failed",
        message: "Unable to create checkout order."
      });
    }

    let checkoutUrl = buildCheckoutUrl(insertedOrder.id, paystackReference);

    try {
      const customerEmail = `${customer_phone.replace(/[^0-9]/g, "") || "customer"}@zukka.shop`;
      const paystackSession = await initializePaystackTransaction({
        email: customerEmail,
        amountNaira: Number(amount_naira),
        reference: paystackReference,
        metadata: {
          order_id: insertedOrder.id,
          merchant_id: merchantId,
          customer_phone,
          delivery_method,
          delivery_lga
        }
      });

      if (paystackSession.authorization_url) {
        checkoutUrl = paystackSession.authorization_url;
      }
    } catch (paystackErr) {
      console.warn("[checkout.create] Paystack initialization fallback to local URL:", paystackErr);
    }

    const { data: order, error: updateError } = await supabase
      .from("orders")
      .update({ checkout_url: checkoutUrl })
      .eq("id", insertedOrder.id)
      .select(
        "id,merchant_id,item_id,customer_phone,amount_naira,payment_method,payment_status,paystack_reference,delivery_method,delivery_lga,checkout_url"
      )
      .single<CheckoutOrderRow>();

    if (updateError || !order) {
      console.error(`[checkout.create] Failed to attach checkout URL to order ${insertedOrder.id}.`, updateError);
      return res.status(500).json({
        error: "checkout_link_creation_failed",
        message: "Unable to attach checkout link to order."
      });
    }

    await recordOutboundCheckoutMessage(order, social_channel, external_user_id, checkoutUrl);

    console.log(`[checkout.create] Checkout link generated for order ${order.id}: ${checkoutUrl}`);
    return res.status(201).json({
      order,
      checkout_link: checkoutUrl,
      paystack_reference: paystackReference,
      social_delivery: social_channel && external_user_id ? "recorded_for_dispatch" : "not_requested"
    });
  }
};
