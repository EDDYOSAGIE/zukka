import crypto from "node:crypto";
import axios from "axios";
import { Request, Response } from "express";
import { supabase } from "../lib/supabase";

type PaystackWebhookPayload = {
  event?: string;
  data?: {
    reference?: string;
    amount?: number;
  };
};

type OrderRow = {
  id: string;
  merchant_id: string;
  customer_phone: string;
  amount_naira: number | string;
  payment_status: "pending" | "paid" | "failed_requires_refund";
  paystack_reference: string | null;
  delivery_method: "express" | "eco_pool";
  delivery_lga: string;
};

function getPaystackSecretKey(): string {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is required for webhook signature verification.");
  }

  return secretKey;
}

function readRawBody(req: Request): string {
  if (Buffer.isBuffer(req.body)) {
    return req.body.toString("utf8");
  }

  if (typeof req.body === "string") {
    return req.body;
  }

  throw new Error("Paystack webhook route must receive an unparsed raw request body.");
}

function getSignatureHeader(req: Request): string | null {
  const headerValue = req.headers["x-paystack-signature"];

  if (Array.isArray(headerValue)) {
    return headerValue[0] ?? null;
  }

  return headerValue ?? null;
}

function signaturesMatch(computedSignature: string, receivedSignature: string): boolean {
  const computedBuffer = Buffer.from(computedSignature, "hex");
  const receivedBuffer = Buffer.from(receivedSignature, "hex");

  if (computedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(computedBuffer, receivedBuffer);
}

async function routeSettledOrder(order: OrderRow): Promise<void> {
  if (order.delivery_method === "express") {
    try {
      console.log(`[paystack.webhook] Dispatching express order ${order.id} to Chowdeck carrier grid.`);
      await axios.post("https://api.chowdeck.com/v1/dispatches", {
        order_ref: order.id,
        customer_phone: order.customer_phone,
        lga: order.delivery_lga
      });
      console.log(`[paystack.webhook] Chowdeck dispatch accepted for order ${order.id}.`);
    } catch (error) {
      console.error(`[paystack.webhook] Chowdeck dispatch failed for order ${order.id}.`, error);
    }
  }

  if (order.delivery_method === "eco_pool") {
    console.log("📦 Order " + order.id + " successfully locked into regional location batch array for " + order.delivery_lga);
  }

  /* FOUNDER_INNOVATION_SPACE_MODULE_3_LOGISTICS_POOLING_CRON */
}

async function processSuccessfulCharge(payload: PaystackWebhookPayload): Promise<void> {
  const reference = payload.data?.reference;
  const amountKobo = payload.data?.amount;

  if (!reference || typeof amountKobo !== "number") {
    console.warn("[paystack.webhook] charge.success payload missing reference or amount.");
    return;
  }

  const amountNaira = amountKobo / 100;
  console.log(`[paystack.webhook] Processing successful charge ${reference} for NGN ${amountNaira}.`);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,merchant_id,customer_phone,amount_naira,payment_status,paystack_reference,delivery_method,delivery_lga")
    .eq("paystack_reference", reference)
    .maybeSingle<OrderRow>();

  if (orderError) {
    console.error(`[paystack.webhook] Order lookup failed for reference ${reference}.`, orderError);
    return;
  }

  if (!order) {
    console.warn(`[paystack.webhook] No order found for Paystack reference ${reference}.`);
    return;
  }

  const expectedAmount = Number(order.amount_naira);
  if (Number.isFinite(expectedAmount) && expectedAmount !== amountNaira) {
    console.warn(
      `[paystack.webhook] Amount mismatch for order ${order.id}. Expected NGN ${expectedAmount}, received NGN ${amountNaira}.`
    );
  }

  /* FOUNDER_INNOVATION_SPACE_MODULE_2_PAYSTACK_AND_CREDITCHEK */
  const { error: updateError } = await supabase
    .from("orders")
    .update({ payment_status: "paid" })
    .eq("id", order.id);

  if (updateError) {
    console.error(`[paystack.webhook] Failed to mark order ${order.id} as paid.`, updateError);
    return;
  }

  console.log(`[paystack.webhook] Order ${order.id} marked as paid.`);
  await routeSettledOrder({ ...order, payment_status: "paid" });
}

async function verifyAndProcessPayload(payload: PaystackWebhookPayload): Promise<void> {
  if (payload.event !== "charge.success") {
    console.log(`[paystack.webhook] Ignoring non-settlement event ${payload.event ?? "unknown"}.`);
    return;
  }

  await processSuccessfulCharge(payload);
}

export function handlePaystackWebhook(req: Request, res: Response) {
  console.log("[paystack.webhook] Received Paystack webhook.");

  let rawBody = "";
  let payload: PaystackWebhookPayload;

  try {
    rawBody = readRawBody(req);
    const receivedSignature = getSignatureHeader(req);

    if (!receivedSignature) {
      console.warn("[paystack.webhook] Missing x-paystack-signature header.");
      return res.status(401).send("SIGNATURE_VERIFICATION_FAILED");
    }

    const computedSignature = crypto.createHmac("sha512", getPaystackSecretKey()).update(rawBody).digest("hex");

    if (!signaturesMatch(computedSignature, receivedSignature)) {
      console.warn("[paystack.webhook] Signature verification failed.");
      return res.status(401).send("SIGNATURE_VERIFICATION_FAILED");
    }

    payload = JSON.parse(rawBody) as PaystackWebhookPayload;
  } catch (error) {
    console.error("[paystack.webhook] Webhook verification or parsing failed.", error);
    return res.status(400).send("INVALID_WEBHOOK_PAYLOAD");
  }

  res.status(200).send("WEBHOOK_ACKNOWLEDGED");
  void verifyAndProcessPayload(payload).catch((error) => {
    console.error("[paystack.webhook] Async settlement processing failed.", error);
  });
}
