import "dotenv/config";
import { supabase } from "../src/lib/supabase";
import { analyzeCustomerIntent } from "../src/services/geminiService";
import { processInboundMessage, ParsedInboundMessage } from "../src/controllers/metaController";

/**
 * CLI Script: Pick and Ingest Customer Messages from Meta channels (Instagram / WhatsApp)
 *
 * Usage:
 *   npx tsx scripts/pick-meta-messages.ts             # Syncs connected merchants from Meta Graph API
 *   npx tsx scripts/pick-meta-messages.ts --simulate  # Simulates and picks realistic customer requests
 */

const sampleCustomerRequests: Array<{
  platform: "instagram" | "whatsapp";
  userHandle: string;
  senderId: string;
  messageText: string;
  scenario: string;
}> = [
  {
    platform: "instagram",
    userHandle: "@chidinma_styles",
    senderId: "ig_user_401921",
    messageText: "Hello! How much is your Ankara Tote Bag? Can you do 12,000 Naira if I pay right now?",
    scenario: "Bargain Negotiation & Immediate Checkout"
  },
  {
    platform: "whatsapp",
    userHandle: "+234 802 444 8899",
    senderId: "wa_user_2348024448899",
    messageText: "Bros abeg what's the last price for the vintage linen shirt? I need 2 pairs sent to Ikeja.",
    scenario: "Quantity Discount & Logistics Request"
  },
  {
    platform: "instagram",
    userHandle: "@temi.ade",
    senderId: "ig_user_582910",
    messageText: "Hi, please do you still have the beaded slides in size 40? How long does delivery to Lekki take?",
    scenario: "Product Availability & Shipping Timeline"
  },
  {
    platform: "whatsapp",
    userHandle: "+234 814 555 7711",
    senderId: "wa_user_2348145557711",
    messageText: "Ready to order! Please send me your account details or payment link so I can transfer immediately.",
    scenario: "Payment & Checkout Request"
  },
  {
    platform: "instagram",
    userHandle: "@kazeem_lagos",
    senderId: "ig_user_773912",
    messageText: "Abeg my sister, 8k last price for the beaded slides? Student budget abeg 🙏",
    scenario: "Informal Market Bargaining (Naira Slang)"
  }
];

async function runMetaMessagePicker() {
  const isSimulation = process.argv.includes("--simulate") || process.argv.includes("-s");
  console.log("==================================================================");
  console.log("         ZUKKA META CONVERSATIONAL MESSAGE INGESTION SCRIPT        ");
  console.log("==================================================================");
  console.log(`Mode: ${isSimulation ? "SIMULATED CUSTOMER REQUESTS" : "LIVE META GRAPH API SYNC"}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // 1. Resolve active merchants
  const { data: merchants, error: merchantError } = await supabase
    .from("merchants")
    .select("id,business_name,sector,meta_page_id,instagram_business_id,meta_page_access_token")
    .limit(10);

  if (merchantError || !merchants || merchants.length === 0) {
    console.error("❌ Failed to query merchants or no merchants found in database.", merchantError);
    process.exit(1);
  }

  console.log(`Found ${merchants.length} registered merchant(s).`);

  if (isSimulation) {
    const targetMerchant = merchants[0];
    console.log(`\nSimulating inbound customer requests for: "${targetMerchant.business_name}" (${targetMerchant.id})`);

    const recipientPageId = targetMerchant.instagram_business_id || targetMerchant.meta_page_id || `page_${targetMerchant.id.slice(0, 8)}`;

    // Ensure merchant has recipient ID for matching if missing
    if (!targetMerchant.instagram_business_id && !targetMerchant.meta_page_id) {
      await supabase
        .from("merchants")
        .update({ instagram_business_id: recipientPageId, meta_page_id: recipientPageId })
        .eq("id", targetMerchant.id);
    }

    let successCount = 0;

    for (const [index, request] of sampleCustomerRequests.entries()) {
      console.log(`\n--------------------------------------------------------------`);
      console.log(`[${index + 1}/${sampleCustomerRequests.length}] Scenario: ${request.scenario}`);
      console.log(`Channel: ${request.platform.toUpperCase()} | From: ${request.userHandle}`);
      console.log(`Message: "${request.messageText}"`);

      // Test AI analysis
      const analysis = await analyzeCustomerIntent(request.messageText, "Selected Item", 15000);
      console.log(`  🤖 AI Intent Analysis:`);
      console.log(`     - Category: ${analysis.requestCategory}`);
      console.log(`     - Bargain Detected: ${analysis.detectsBargain ? "YES" : "NO"}`);
      if (analysis.customerOfferPrice) {
        console.log(`     - Customer Offer Price: NGN ${analysis.customerOfferPrice.toLocaleString()}`);
      }
      console.log(`     - Sentiment: ${analysis.customerSentiment}`);
      console.log(`     - Summary: ${analysis.summary}`);

      const inboundMsg: ParsedInboundMessage = {
        platform: request.platform,
        senderId: request.senderId,
        recipientPageId,
        messageText: request.messageText,
        userHandle: request.userHandle
      };

      try {
        await processInboundMessage(inboundMsg);
        console.log(`  ✅ Successfully ingested and broadcasted to merchant live inbox.`);
        successCount++;
      } catch (err) {
        console.error(`  ❌ Failed to process message:`, err);
      }
    }

    console.log(`\n==============================================================`);
    console.log(`Summary: ${successCount}/${sampleCustomerRequests.length} customer messages picked & ingested.`);
    console.log(`Check your Zukka Inbox page to view these live conversation threads!`);
    console.log(`==============================================================\n`);
    return;
  }

  // 2. Live Meta Graph API Sync
  let totalPicked = 0;
  for (const merchant of merchants) {
    const accessToken = merchant.meta_page_access_token;
    const targetId = merchant.instagram_business_id || merchant.meta_page_id;

    if (!accessToken || !targetId) {
      console.log(`⏩ Skipping ${merchant.business_name}: Meta account not connected.`);
      continue;
    }

    console.log(`\n🔍 Polling Meta Graph API for merchant "${merchant.business_name}" (${targetId})...`);

    try {
      const graphUrl = `https://graph.facebook.com/v16.0/${targetId}/conversations?fields=id,messages{id,created_time,from,to,message}&access_token=${encodeURIComponent(accessToken)}`;
      const response = await fetch(graphUrl);
      const data = await response.json();

      if (!response.ok) {
        console.warn(`⚠️ Meta API warning for ${merchant.business_name}:`, data?.error?.message ?? "Request failed");
        continue;
      }

      const conversations = data?.data ?? [];
      console.log(`  Retrieved ${conversations.length} conversation thread(s).`);

      for (const convo of conversations) {
        for (const msg of convo.messages?.data ?? []) {
          const senderId = msg.from?.id;
          const messageText = msg.message?.trim();

          if (senderId && senderId !== targetId && messageText) {
            // Check if already in chat_logs
            const { data: existing } = await supabase
              .from("chat_logs")
              .select("id")
              .eq("merchant_id", merchant.id)
              .eq("external_user_id", senderId)
              .eq("message_text", messageText)
              .maybeSingle();

            if (!existing) {
              console.log(`  📥 Ingesting new customer message from ${senderId}: "${messageText.slice(0, 40)}..."`);
              await processInboundMessage({
                platform: merchant.instagram_business_id ? "instagram" : "whatsapp",
                senderId,
                recipientPageId: targetId,
                messageText,
                userHandle: msg.from?.name || msg.from?.username || senderId
              });
              totalPicked++;
            }
          }
        }
      }
    } catch (err) {
      console.error(`  ❌ Error querying Meta API for ${merchant.business_name}:`, err);
    }
  }

  console.log(`\n==============================================================`);
  console.log(`Sync complete: ${totalPicked} new customer messages picked.`);
  console.log(`==============================================================\n`);
}

runMetaMessagePicker()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error running Meta message picker:", err);
    process.exit(1);
  });
