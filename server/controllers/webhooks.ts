import crypto from "node:crypto";
import { Request, Response } from "express";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const hagglePattern = /\b(discount|last price|abeg|reduce|markdown|off|cheaper)\b/i;

export async function handleInboundMetaWebhook(req: Request, res: Response) {
  res.status(200).json({ ok: true });

  const entry = req.body?.entry?.[0]?.messaging?.[0] ?? req.body?.messages?.[0];
  const messageText = entry?.message?.text ?? entry?.text ?? "";
  const customerHandle = entry?.sender?.id ?? entry?.from ?? "unknown-customer";
  const merchantId = req.body?.merchant_id ?? process.env.DEFAULT_MERCHANT_ID;
  const inventoryId = req.body?.inventory_id ?? null;
  const bargainDetected = hagglePattern.test(messageText);

  try {
    await pool.query(
      `INSERT INTO chat_logs (merchant_id, inventory_id, channel, customer_handle, message_text, bargain_detected)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [merchantId, inventoryId, "instagram", customerHandle, messageText, bargainDetected]
    );
  } catch (error) {
    console.error("meta webhook persistence failed", error);
  }
}

export async function handlePaystackFulfillmentWebhook(req: Request, res: Response) {
  const secret = process.env.PAYSTACK_SECRET_KEY ?? "";
  const signature = req.headers["x-paystack-signature"];
  const rawBody = JSON.stringify(req.body);
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");

  if (signature !== expected) {
    return res.status(401).json({ error: "invalid paystack signature" });
  }

  if (req.body?.event === "charge.success") {
    const ref = req.body?.data?.reference;
    const lga = req.body?.data?.metadata?.lga ?? "Unassigned";
    const method = req.body?.data?.metadata?.delivery_method ?? "pool";
    const logisticsBucket = method === "pool" ? `${lga} Hub Cluster` : "Express Dispatch Rider";

    await pool.query(
      `UPDATE orders
       SET status = 'paid', paid_at = NOW(), logistics_bucket = $2
       WHERE checkout_ref = $1`,
      [ref, logisticsBucket]
    );
  }

  return res.status(200).json({ received: true });
}
