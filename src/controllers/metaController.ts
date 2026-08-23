import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { io } from "../lib/realtime";
import { analyzeCustomerIntent } from "../services/openaiService";

type MetaWebhookQuery = {
  "hub.mode"?: string;
  "hub.verify_token"?: string;
  "hub.challenge"?: string;
};

type MetaMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: { text?: string };
};

type WhatsAppMessage = {
  from?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
};

type WhatsAppValue = {
  metadata?: {
    phone_number_id?: string;
    display_phone_number?: string;
  };
  messages?: WhatsAppMessage[];
};

type MetaWebhookBody = {
  object?: string;
  entry?: Array<{
    id?: string;
    messaging?: MetaMessagingEvent[];
    changes?: Array<{
      field?: string;
      value?: WhatsAppValue;
    }>;
  }>;
};

type MerchantRow = {
  id: string;
  business_name: string;
  meta_page_id: string | null;
};

type InventoryRow = {
  id: string;
  item_name: string;
  base_price_naira: number | string;
  minimum_margin_naira: number | string;
  created_at: string;
};

type ParsedInboundMessage = {
  platform: "instagram" | "whatsapp";
  senderId: string;
  recipientPageId: string;
  messageText: string;
  userHandle: string;
};

function getVerifyToken(): string {
  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (!verifyToken) {
    throw new Error("META_VERIFY_TOKEN is required for Meta webhook verification.");
  }

  return verifyToken;
}

function getMetaAppId(): string {
  const appId = process.env.META_APP_ID;

  if (!appId) {
    throw new Error("META_APP_ID is required for Meta onboarding.");
  }

  return appId;
}

function getMetaAppSecret(): string {
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) {
    throw new Error("META_APP_SECRET is required for Meta onboarding.");
  }

  return appSecret;
}

function getMetaRedirectUri(): string {
  const redirectUri = process.env.META_REDIRECT_URI;

  if (!redirectUri) {
    throw new Error("META_REDIRECT_URI is required for Meta onboarding.");
  }

  return redirectUri;
}

function getMetaPostConnectRedirectUri(): string {
  return process.env.META_POST_CONNECT_REDIRECT_URI ?? "http://127.0.0.1:5173";
}

function getMetaScopes(): string[] {
  return [
    "pages_show_list",
    "pages_read_engagement",
    "pages_messaging",
    "pages_manage_metadata",
    "instagram_basic",
    "instagram_manage_messages",
    "instagram_manage_insights",
    "whatsapp_business_messaging",
    "whatsapp_business_management",
    "business_management",
    "public_profile"
  ];
}

function buildMetaConnectUrl(): string {
  const appId = getMetaAppId();
  const redirectUri = getMetaRedirectUri();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: getMetaScopes().join(","),
    auth_type: "rerequest"
  });

  return `https://www.facebook.com/v16.0/dialog/oauth?${params.toString()}`;
}

async function exchangeCodeForAccessToken(code: string): Promise<string> {
  const appId = getMetaAppId();
  const appSecret = getMetaAppSecret();
  const redirectUri = getMetaRedirectUri();

  const response = await fetch(
    `https://graph.facebook.com/v16.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`
  );

  const body = await response.json();

  if (!response.ok || !body.access_token) {
    throw new Error(body.error?.message ?? "Unable to exchange Meta authorization code for an access token.");
  }

  return body.access_token;
}

async function resolveMetaRecipientId(accessToken: string): Promise<string | null> {
  const pageResponse = await fetch(
    `https://graph.facebook.com/v16.0/me/accounts?fields=id,name,instagram_business_account&access_token=${encodeURIComponent(
      accessToken
    )}`
  );

  const pageData = await pageResponse.json();
  if (Array.isArray(pageData.data) && pageData.data.length > 0) {
    const firstPage = pageData.data[0];
    if (firstPage.instagram_business_account?.id) {
      return firstPage.instagram_business_account.id;
    }
    if (firstPage.id) {
      return firstPage.id;
    }
  }

  const whatsappResponse = await fetch(
    `https://graph.facebook.com/v16.0/me?fields=whatsapp_business_accounts{phone_numbers{id}}&access_token=${encodeURIComponent(
      accessToken
    )}`
  );

  const whatsappData = await whatsappResponse.json();
  const account = whatsappData?.whatsapp_business_accounts?.data?.[0];
  const phoneId = account?.phone_numbers?.data?.[0]?.id;
  return phoneId ?? null;
}

function renderMetaConnectedHtml(postRedirectUri: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Zukka Meta Connected</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,sans-serif;background:#f8fafc;color:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:1.5rem;}main{max-width:560px;border:1px solid #e2e8f0;border-radius:1rem;background:#fff;padding:2rem;box-shadow:0 18px 40px rgba(15,23,42,.08);}button{margin-top:1.5rem;padding:.9rem 1.4rem;border:none;border-radius:.75rem;background:#0f172a;color:#fff;font-weight:800;cursor:pointer;}</style>
</head>
<body>
<main>
<h1>Meta connection complete</h1>
<p>Your Instagram and WhatsApp business channels are now connected to Zukka.</p>
<p>Close this window or return to your dashboard to see the updated social inbox and onboarding status.</p>
<a href="${postRedirectUri}"><button>Return to Zukka</button></a>
</main>
</body>
</html>`;
}

export async function getMetaConnectUrl(req: Request<object, string, object>, res: Response) {
  try {
    return res.status(200).json({ connectUrl: buildMetaConnectUrl() });
  } catch (error) {
    console.error("[meta.connect] Failed to generate connection URL.", error);
    return res.status(500).json({ error: "meta_connect_failed", message: error instanceof Error ? error.message : "Unable to generate Meta connect URL." });
  }
}

export async function handleMetaCallback(req: Request<{ merchantId?: string }, object, object, { code?: string; error?: string }>, res: Response) {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("Meta connection failed. No authorization code was provided.");
  }

  try {
    const accessToken = await exchangeCodeForAccessToken(code);
    const recipientId = await resolveMetaRecipientId(accessToken);

    if (!recipientId) {
      return res.status(400).send("Meta connection succeeded, but no Instagram or WhatsApp business identifier could be retrieved.");
    }

    const { error } = await supabase
      .from("merchants")
      .update({ meta_page_id: recipientId })
      .eq("id", req.params.merchantId);

    if (error) {
      console.error("[meta.callback] Failed to persist connected Meta identifier.", error);
      return res.status(500).send("Connected to Meta, but failed to save your connection. Please contact support.");
    }

    return res.status(200).send(renderMetaConnectedHtml(getMetaPostConnectRedirectUri()));
  } catch (error) {
    console.error("[meta.callback] Meta callback processing failed.", error);
    return res.status(500).send(error instanceof Error ? error.message : "Unable to finalize Meta connection.");
  }
}

export async function handleMetaFinalize(req: Request<{ merchantId: string }>, res: Response) {
  try {
    const code = (req.query.code as string) || (req.body && (req.body.code as string));

    if (!code) {
      return res.status(400).json({ error: "missing_code", message: "Authorization code is required." });
    }

    const merchantId = req.params.merchantId;

    if (!merchantId) {
      return res.status(403).json({ error: "missing_merchant_context", message: "Authenticated merchant context is required." });
    }

    const accessToken = await exchangeCodeForAccessToken(code);
    const recipientId = await resolveMetaRecipientId(accessToken);

    if (!recipientId) {
      return res.status(400).json({ error: "no_recipient", message: "Connected but no Instagram/WhatsApp identifier was found." });
    }

    const { error } = await supabase
      .from("merchants")
      .update({ meta_page_id: recipientId })
      .eq("id", merchantId);

    if (error) {
      console.error("[meta.finalize] Failed to persist connected Meta identifier.", error);
      return res.status(500).json({ error: "persist_failed", message: "Failed to save connection to merchant record." });
    }

    return res.status(200).json({ ok: true, meta_page_id: recipientId });
  } catch (error) {
    console.error("[meta.finalize] Meta finalize failed.", error);
    return res.status(500).json({ error: "finalize_failed", message: error instanceof Error ? error.message : "Failed to finalize Meta connection." });
  }
}

function getWhatsAppMessageText(message: WhatsAppMessage): string {
  return (
    message.text?.body ??
    message.button?.text ??
    message.interactive?.button_reply?.title ??
    message.interactive?.list_reply?.title ??
    ""
  ).trim();
}

function parseInstagramMessages(body: MetaWebhookBody): ParsedInboundMessage[] {
  const messages: ParsedInboundMessage[] = [];

  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      const senderId = event.sender?.id;
      const recipientPageId = event.recipient?.id ?? entry.id;
      const messageText = event.message?.text?.trim();

      if (senderId && recipientPageId && messageText) {
        messages.push({
          platform: "instagram",
          senderId,
          recipientPageId,
          messageText,
          userHandle: senderId
        });
      }
    }
  }

  return messages;
}

function parseWhatsAppMessages(body: MetaWebhookBody): ParsedInboundMessage[] {
  const messages: ParsedInboundMessage[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const recipientPageId = value?.metadata?.phone_number_id ?? entry.id;

      for (const message of value?.messages ?? []) {
        const senderId = message.from;
        const messageText = getWhatsAppMessageText(message);

        if (senderId && recipientPageId && messageText) {
          messages.push({
            platform: "whatsapp",
            senderId,
            recipientPageId,
            messageText,
            userHandle: senderId
          });
        }
      }
    }
  }

  return messages;
}

function parseInboundMessages(body: MetaWebhookBody): ParsedInboundMessage[] {
  return [...parseInstagramMessages(body), ...parseWhatsAppMessages(body)];
}

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function calculateSafeCounterOffer(
  customerOfferPrice: number | undefined,
  basePrice: number,
  minimumMargin: number
): number | null {
  const fallbackMarkdown = Math.round(basePrice * 0.9 * 100) / 100;
  const proposedCounterOffer =
    typeof customerOfferPrice === "number" && customerOfferPrice >= minimumMargin
      ? customerOfferPrice
      : fallbackMarkdown;

  return proposedCounterOffer >= minimumMargin ? proposedCounterOffer : null;
}

async function processInboundMessage(message: ParsedInboundMessage): Promise<void> {
  console.log(
    `[meta.webhook] Processing ${message.platform} inbound message from ${message.senderId} to ${message.recipientPageId}.`
  );

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id,business_name,meta_page_id")
    .eq("meta_page_id", message.recipientPageId)
    .maybeSingle<MerchantRow>();

  if (merchantError) {
    console.error("[meta.webhook] Merchant lookup failed.", merchantError);
    return;
  }

  if (!merchant) {
    console.warn(`[meta.webhook] No merchant found for Meta recipient ${message.recipientPageId}.`);
    return;
  }

  const { data: chatLog, error: chatLogError } = await supabase
    .from("chat_logs")
    .insert({
      merchant_id: merchant.id,
      platform: message.platform,
      external_user_id: message.senderId,
      user_handle: message.userHandle,
      message_text: message.messageText,
      direction: "inbound"
    })
    .select("id")
    .single<{ id: string }>();

  if (chatLogError || !chatLog) {
    console.error("[meta.webhook] Failed to persist inbound chat log.", chatLogError);
    return;
  }

  const { data: inventoryItem, error: inventoryError } = await supabase
    .from("inventory")
    .select("id,item_name,base_price_naira,minimum_margin_naira,created_at")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<InventoryRow>();

  if (inventoryError) {
    console.error("[meta.webhook] Inventory lookup failed.", inventoryError);
    return;
  }

  if (!inventoryItem) {
    console.warn(`[meta.webhook] Merchant ${merchant.id} has no inventory item for negotiation analysis.`);
    return;
  }

  const basePrice = toNumber(inventoryItem.base_price_naira);
  const minimumMargin = toNumber(inventoryItem.minimum_margin_naira);
  const analysis = await analyzeCustomerIntent(message.messageText, inventoryItem.item_name, basePrice);

  const { error: updateError } = await supabase
    .from("chat_logs")
    .update({ sentiment_flag: analysis.customerSentiment })
    .eq("id", chatLog.id);

  if (updateError) {
    console.error("[meta.webhook] Failed to update chat sentiment flag.", updateError);
  }

  if (!analysis.detectsBargain) {
    console.log(`[meta.webhook] Message ${chatLog.id} did not trigger bargain dispatch.`);
    return;
  }

  const safeCounterOffer = calculateSafeCounterOffer(analysis.customerOfferPrice, basePrice, minimumMargin);

  if (safeCounterOffer === null) {
    console.warn(`[meta.webhook] Bargain detected for ${chatLog.id}, but safe counter-offer breached floor.`);
    return;
  }

  io.to(`merchant_${merchant.id}`).emit("bargain_alert", {
    merchantId: merchant.id,
    channel: message.platform,
    buyerHandle: message.userHandle,
    externalUserId: message.senderId,
    originalPrice: basePrice,
    itemName: inventoryItem.item_name,
    recommendedCounterOfferPrice: safeCounterOffer,
    customerOfferPrice: analysis.customerOfferPrice ?? null,
    customerSentiment: analysis.customerSentiment,
    chatLogId: chatLog.id
  });

  console.log(`[meta.webhook] Bargain alert emitted for merchant ${merchant.id} on ${message.platform}.`);
  /* FOUNDER_INNOVATION_SPACE_MODULE_1_CHANNELS_AND_NEGOTIATION */
}

async function processInboundMessagesSafely(messages: ParsedInboundMessage[]): Promise<void> {
  for (const message of messages) {
    try {
      await processInboundMessage(message);
    } catch (error) {
      console.error("[meta.webhook] Inbound message processing failed.", error);
    }
  }
}

export function verifyMetaWebhook(req: Request<object, string, object, MetaWebhookQuery>, res: Response) {
  console.log("[meta.verify] Received Meta webhook verification request.");

  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === getVerifyToken() && challenge) {
      console.log("[meta.verify] Verification token matched. Returning challenge.");
      return res.status(200).send(challenge);
    }

    console.warn("[meta.verify] Verification rejected because mode or token did not match.");
    return res.sendStatus(403);
  } catch (error) {
    console.error("[meta.verify] Verification failed due to server configuration.", error);
    return res.sendStatus(500);
  }
}

export function receiveMetaWebhook(req: Request<object, string, MetaWebhookBody>, res: Response) {
  console.log("[meta.webhook] Received inbound Meta payload.");
  res.status(200).send("EVENT_RECEIVED");

  const messages = parseInboundMessages(req.body);

  if (messages.length === 0) {
    console.warn("[meta.webhook] Payload acknowledged but no supported Instagram or WhatsApp messages were found.");
    return;
  }

  void processInboundMessagesSafely(messages);
}
