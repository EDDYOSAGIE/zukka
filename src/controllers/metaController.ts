import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { io } from "../lib/realtime";
import { analyzeCustomerIntent, CustomerRequestCategory } from "../services/geminiService";

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
  instagram_business_id?: string | null;
  meta_page_access_token?: string | null;
};

type InventoryRow = {
  id: string;
  item_name: string;
  base_price_naira: number | string;
  minimum_margin_naira: number | string;
  created_at: string;
};

export type ParsedInboundMessage = {
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

type ResolvedMetaDetails = {
  metaPageId: string | null;
  metaPageAccessToken: string | null;
  instagramBusinessId: string | null;
};

async function resolveMetaAccountDetails(accessToken: string): Promise<ResolvedMetaDetails> {
  let metaPageId: string | null = null;
  let metaPageAccessToken: string | null = null;
  let instagramBusinessId: string | null = null;

  try {
    const pageResponse = await fetch(
      `https://graph.facebook.com/v16.0/me/accounts?fields=id,name,access_token,instagram_business_account{id}&access_token=${encodeURIComponent(
        accessToken
      )}`
    );

    const pageData = await pageResponse.json();
    if (Array.isArray(pageData?.data) && pageData.data.length > 0) {
      const firstPage = pageData.data[0];
      metaPageId = firstPage.id ?? null;
      metaPageAccessToken = firstPage.access_token ?? null;
      if (firstPage.instagram_business_account?.id) {
        instagramBusinessId = firstPage.instagram_business_account.id;
      }
    }
  } catch (err) {
    console.warn("[meta.resolve] Error fetching Facebook pages/Instagram business accounts:", err);
  }

  try {
    const whatsappResponse = await fetch(
      `https://graph.facebook.com/v16.0/me?fields=whatsapp_business_accounts{phone_numbers{id}}&access_token=${encodeURIComponent(
        accessToken
      )}`
    );

    const whatsappData = await whatsappResponse.json();
    const account = whatsappData?.whatsapp_business_accounts?.data?.[0];
    const phoneId = account?.phone_numbers?.data?.[0]?.id;
    if (phoneId && !metaPageId) {
      metaPageId = phoneId;
    }
  } catch (err) {
    console.warn("[meta.resolve] Error fetching WhatsApp business accounts:", err);
  }

  return {
    metaPageId: instagramBusinessId || metaPageId,
    metaPageAccessToken,
    instagramBusinessId
  };
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
    const resolved = await resolveMetaAccountDetails(accessToken);

    if (!resolved.metaPageId && !resolved.instagramBusinessId) {
      return res.status(400).send("Meta connection succeeded, but no Instagram or WhatsApp business identifier could be retrieved.");
    }

    const updatePayload: Record<string, any> = {
      meta_page_id: resolved.metaPageId
    };
    if (resolved.metaPageAccessToken) {
      updatePayload.meta_page_access_token = resolved.metaPageAccessToken;
    }
    if (resolved.instagramBusinessId) {
      updatePayload.instagram_business_id = resolved.instagramBusinessId;
    }

    const { error } = await supabase
      .from("merchants")
      .update(updatePayload)
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
    const resolved = await resolveMetaAccountDetails(accessToken);

    if (!resolved.metaPageId && !resolved.instagramBusinessId) {
      return res.status(400).json({ error: "no_recipient", message: "Connected but no Instagram/WhatsApp identifier was found." });
    }

    const updatePayload: Record<string, any> = {
      meta_page_id: resolved.metaPageId
    };
    if (resolved.metaPageAccessToken) {
      updatePayload.meta_page_access_token = resolved.metaPageAccessToken;
    }
    if (resolved.instagramBusinessId) {
      updatePayload.instagram_business_id = resolved.instagramBusinessId;
    }

    const { error } = await supabase
      .from("merchants")
      .update(updatePayload)
      .eq("id", merchantId);

    if (error) {
      console.error("[meta.finalize] Failed to persist connected Meta identifier.", error);
      return res.status(500).json({ error: "persist_failed", message: "Failed to save connection to merchant record." });
    }

    return res.status(200).json({
      ok: true,
      meta_page_id: resolved.metaPageId,
      instagram_business_id: resolved.instagramBusinessId
    });
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

export async function processInboundMessage(message: ParsedInboundMessage): Promise<void> {
  console.log(
    `[meta.webhook] Processing ${message.platform} inbound message from ${message.senderId} to ${message.recipientPageId}.`
  );

  let { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id,business_name,meta_page_id,instagram_business_id,meta_page_access_token")
    .eq("meta_page_id", message.recipientPageId)
    .maybeSingle<MerchantRow>();

  if (!merchant && !merchantError) {
    const { data: igMerchant, error: igError } = await supabase
      .from("merchants")
      .select("id,business_name,meta_page_id,instagram_business_id,meta_page_access_token")
      .eq("instagram_business_id", message.recipientPageId)
      .maybeSingle<MerchantRow>();
    if (igMerchant) {
      merchant = igMerchant;
    } else {
      merchantError = igError;
    }
  }

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

  const { data: inventoryItems, error: inventoryError } = await supabase
    .from("inventory")
    .select("id,item_name,base_price_naira,minimum_margin_naira,created_at")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (inventoryError) {
    console.error("[meta.webhook] Inventory lookup failed.", inventoryError);
  }

  let inventoryItem: InventoryRow | undefined;
  if (Array.isArray(inventoryItems) && inventoryItems.length > 0) {
    const textLower = message.messageText.toLowerCase();
    inventoryItem = inventoryItems.find((item) => {
      const words = item.item_name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
      return words.some((w: string) => textLower.includes(w));
    }) ?? inventoryItems[0];
  }

  const basePrice = inventoryItem ? toNumber(inventoryItem.base_price_naira) : 0;
  const minimumMargin = inventoryItem ? toNumber(inventoryItem.minimum_margin_naira) : 0;
  const analysis = await analyzeCustomerIntent(
    message.messageText,
    inventoryItem?.item_name ?? "General Item",
    basePrice
  );

  const { error: updateError } = await supabase
    .from("chat_logs")
    .update({ sentiment_flag: analysis.requestCategory || analysis.customerSentiment })
    .eq("id", chatLog.id);

  if (updateError) {
    console.error("[meta.webhook] Failed to update chat sentiment flag.", updateError);
  }

  const safeCounterOffer = inventoryItem
    ? calculateSafeCounterOffer(analysis.customerOfferPrice, basePrice, minimumMargin)
    : null;

  // Always emit inbound chat message to merchant room for real-time live inbox
  io.to(`merchant_${merchant.id}`).emit("inbound_chat", {
    chatLogId: chatLog.id,
    merchantId: merchant.id,
    channel: message.platform,
    buyerHandle: message.userHandle,
    externalUserId: message.senderId,
    messageText: message.messageText,
    createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    detectsBargain: analysis.detectsBargain,
    customerSentiment: analysis.customerSentiment,
    requestCategory: analysis.requestCategory,
    summary: analysis.summary,
    itemId: inventoryItem?.id,
    itemName: inventoryItem?.item_name,
    originalPrice: basePrice,
    customerOfferPrice: analysis.customerOfferPrice ?? null,
    recommendedCounterOfferPrice: safeCounterOffer
  });

  if (!analysis.detectsBargain || safeCounterOffer === null || !inventoryItem) {
    console.log(`[meta.webhook] Inbound message ${chatLog.id} streamed to live inbox (bargain alert not triggered).`);
    return;
  }

  // If bargain detected and safe counteroffer exists, emit bargain alert
  io.to(`merchant_${merchant.id}`).emit("bargain_alert", {
    chatLogId: chatLog.id,
    merchantId: merchant.id,
    channel: message.platform,
    buyerHandle: message.userHandle,
    externalUserId: message.senderId,
    messageText: message.messageText,
    originalPrice: basePrice,
    itemName: inventoryItem.item_name,
    itemId: inventoryItem.id,
    recommendedCounterOfferPrice: safeCounterOffer,
    customerOfferPrice: analysis.customerOfferPrice ?? null,
    customerSentiment: analysis.customerSentiment
  });

  console.log(`[meta.webhook] Bargain alert emitted for merchant ${merchant.id} on ${message.platform}.`);
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

export async function dispatchMetaMessage({
  platform,
  recipientId,
  messageText,
  accessToken
}: {
  platform: "instagram" | "whatsapp";
  recipientId: string;
  messageText: string;
  accessToken?: string | null;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!accessToken) {
    console.log(`[meta.dispatch] No access token available; recorded locally for ${platform} to ${recipientId}.`);
    return { ok: true, messageId: "local-dispatch" };
  }

  try {
    if (platform === "whatsapp") {
      const response = await fetch(`https://graph.facebook.com/v16.0/me/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipientId,
          type: "text",
          text: { body: messageText }
        })
      });
      const data = await response.json();
      if (!response.ok) {
        console.warn("[meta.dispatch] WhatsApp API returned error:", data);
        return { ok: false, error: data?.error?.message ?? "WhatsApp delivery failed" };
      }
      return { ok: true, messageId: data?.messages?.[0]?.id };
    } else {
      const response = await fetch(`https://graph.facebook.com/v16.0/me/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: messageText }
        })
      });
      const data = await response.json();
      if (!response.ok) {
        console.warn("[meta.dispatch] Instagram API returned error:", data);
        return { ok: false, error: data?.error?.message ?? "Instagram delivery failed" };
      }
      return { ok: true, messageId: data?.message_id };
    }
  } catch (error) {
    console.error("[meta.dispatch] Outbound delivery exception:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Dispatch failed" };
  }
}

export async function getMerchantChats(req: Request<{ merchantId?: string }>, res: Response) {
  const merchantId = req.params.merchantId;
  if (!merchantId) {
    return res.status(401).json({ error: "unauthorized", message: "Merchant authentication required." });
  }

  try {
    const { data: chatRows, error: chatError } = await supabase
      .from("chat_logs")
      .select("id,merchant_id,platform,external_user_id,user_handle,message_text,direction,sentiment_flag,created_at")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (chatError) {
      console.error("[meta.chats] Failed to fetch chat logs:", chatError);
      return res.status(500).json({ error: "chat_fetch_failed", message: "Unable to load chats." });
    }

    return res.status(200).json({ chats: chatRows ?? [] });
  } catch (err) {
    console.error("[meta.chats] Exception fetching chats:", err);
    return res.status(500).json({ error: "server_error", message: "Unable to load chats." });
  }
}

export async function replyToChat(
  req: Request<{ merchantId?: string; chatId?: string }, object, { messageText?: string; suggestedPrice?: number }>,
  res: Response
) {
  const merchantId = req.params.merchantId;
  const chatId = req.params.chatId;
  const messageText = req.body?.messageText?.trim();
  const suggestedPrice = req.body?.suggestedPrice;

  if (!merchantId || !chatId || !messageText) {
    return res.status(400).json({ error: "missing_fields", message: "chatId and messageText are required." });
  }

  try {
    const { data: originalChat, error: lookupError } = await supabase
      .from("chat_logs")
      .select("id,merchant_id,platform,external_user_id,user_handle")
      .eq("id", chatId)
      .eq("merchant_id", merchantId)
      .maybeSingle<{
        id: string;
        merchant_id: string;
        platform: "instagram" | "whatsapp";
        external_user_id: string;
        user_handle: string;
      }>();

    if (lookupError || !originalChat) {
      return res.status(404).json({ error: "chat_not_found", message: "Target chat not found." });
    }

    const { data: merchant } = await supabase
      .from("merchants")
      .select("meta_page_access_token")
      .eq("id", merchantId)
      .maybeSingle<{ meta_page_access_token: string | null }>();

    const { data: outboundLog, error: insertError } = await supabase
      .from("chat_logs")
      .insert({
        merchant_id: merchantId,
        platform: originalChat.platform,
        external_user_id: originalChat.external_user_id,
        user_handle: originalChat.user_handle,
        message_text: messageText,
        direction: "outbound",
        sentiment_flag: suggestedPrice ? "counteroffer_sent" : "merchant_reply"
      })
      .select("id,created_at")
      .single<{ id: string; created_at: string }>();

    if (insertError) {
      console.error("[meta.reply] Failed to record outbound chat:", insertError);
      return res.status(500).json({ error: "record_failed", message: "Unable to save reply." });
    }

    await dispatchMetaMessage({
      platform: originalChat.platform,
      recipientId: originalChat.external_user_id,
      messageText,
      accessToken: merchant?.meta_page_access_token
    });

    return res.status(200).json({
      ok: true,
      chatLogId: outboundLog?.id,
      message: "Reply sent and recorded."
    });
  } catch (err) {
    console.error("[meta.reply] Exception replying to chat:", err);
    return res.status(500).json({ error: "server_error", message: "Failed to send reply." });
  }
}

export async function syncMetaConversations(req: Request<{ merchantId?: string }>, res: Response) {
  const merchantId = req.params.merchantId;
  if (!merchantId) {
    return res.status(401).json({ error: "unauthorized", message: "Merchant authentication required." });
  }

  try {
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id,business_name,meta_page_id,instagram_business_id,meta_page_access_token")
      .eq("id", merchantId)
      .maybeSingle<MerchantRow>();

    if (merchantError || !merchant) {
      return res.status(404).json({ error: "merchant_not_found", message: "Merchant record not found." });
    }

    const accessToken = merchant.meta_page_access_token;
    const targetId = merchant.instagram_business_id || merchant.meta_page_id;

    if (!accessToken || !targetId) {
      return res.status(200).json({
        ok: true,
        messagesCount: 0,
        message: "Meta channel is not yet connected. Connect your Instagram or WhatsApp account to sync live messages."
      });
    }

    console.log(`[meta.sync] Fetching conversations from Meta Graph API for merchant ${merchantId}.`);
    const isInstagram = Boolean(merchant.instagram_business_id);
    const platform = isInstagram ? "instagram" : "whatsapp";

    let fetchedMessages: ParsedInboundMessage[] = [];

    try {
      const graphUrl = isInstagram
        ? `https://graph.facebook.com/v16.0/${targetId}/conversations?fields=id,messages{id,created_time,from,to,message}&access_token=${encodeURIComponent(accessToken)}`
        : `https://graph.facebook.com/v16.0/${targetId}/conversations?fields=id,messages{id,created_time,from,to,message}&access_token=${encodeURIComponent(accessToken)}`;

      const response = await fetch(graphUrl);
      const data = await response.json();

      if (Array.isArray(data?.data)) {
        for (const convo of data.data) {
          const messages = convo.messages?.data ?? [];
          for (const msg of messages) {
            const senderId = msg.from?.id;
            const messageText = msg.message?.trim();
            if (senderId && senderId !== targetId && messageText) {
              fetchedMessages.push({
                platform,
                senderId,
                recipientPageId: targetId,
                messageText,
                userHandle: msg.from?.username || msg.from?.name || senderId
              });
            }
          }
        }
      }
    } catch (graphError) {
      console.warn("[meta.sync] Meta Graph API query failed:", graphError);
    }

    let processedCount = 0;
    for (const msg of fetchedMessages) {
      const { data: existing } = await supabase
        .from("chat_logs")
        .select("id")
        .eq("merchant_id", merchantId)
        .eq("external_user_id", msg.senderId)
        .eq("message_text", msg.messageText)
        .maybeSingle();

      if (!existing) {
        await processInboundMessage(msg);
        processedCount++;
      }
    }

    return res.status(200).json({
      ok: true,
      messagesCount: processedCount,
      message: `Successfully synced ${processedCount} new customer messages from ${platform}.`
    });
  } catch (error) {
    console.error("[meta.sync] Error during conversation sync:", error);
    return res.status(500).json({
      error: "sync_failed",
      message: error instanceof Error ? error.message : "Unable to sync Meta conversations."
    });
  }
}

