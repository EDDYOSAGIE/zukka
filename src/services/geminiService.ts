import axios from "axios";

export type CustomerSentiment = "neutral" | "positive" | "negative_dispute";

export type CustomerRequestCategory =
  | "bargain_negotiation"
  | "product_inquiry"
  | "shipping_inquiry"
  | "payment_request"
  | "order_status"
  | "general_chat";

export type CustomerIntentAnalysis = {
  detectsBargain: boolean;
  customerOfferPrice?: number;
  customerSentiment: CustomerSentiment;
  requestCategory: CustomerRequestCategory;
  summary: string;
};

export type SectorNewsHeadline = {
  title: string;
  summary: string;
  signal: string;
  howItHelpsYourBusiness: string;
};

export type SectorNewsSnapshot = {
  sector: string;
  generatedAt: string;
  headlines: SectorNewsHeadline[];
  insights: string[];
  nextUpdate: string;
  source: "gemini-ai" | "curated-fallback";
};

const fallbackSectorTemplates: Record<
  string,
  { headlines: SectorNewsHeadline[]; insights: string[] }
> = {
  fashion: {
    headlines: [
      {
        title: "Lagos shoppers shifting toward capsule collections & versatile work-leisure sets",
        summary: "Inflation-conscious buyers are prioritizing multipurpose pieces over one-off party apparel.",
        signal: "Demand Shift",
        howItHelpsYourBusiness: "Promote 2-in-1 styling bundles in your Instagram Reels; bundles average 35% higher checkout completion."
      },
      {
        title: "Short drop windows beating algorithm reach suppression across social commerce",
        summary: "Merchants launching 48-hour limited stock windows see 2.4x higher immediate engagement.",
        signal: "Conversion Rate",
        howItHelpsYourBusiness: "Use the Zukka Scheduled Drops feature with countdown stickers to create urgency on high-demand stock."
      },
      {
        title: "Pooled LGA dispatch reducing customer checkout abandonment in Lekki & Ikeja",
        summary: "High individual dispatch costs cause 42% cart drop-offs; pooled deliveries preserve sales margin.",
        signal: "Fulfilment Margin",
        howItHelpsYourBusiness: "Offer customer the Eco-Savings Pool (1,200 NGN) at checkout instead of 3,500 NGN single riders."
      }
    ],
    insights: [
      "Bundle matching accessories with core apparel to boost average basket value.",
      "Pair each drop with a transparent price and sizing chart to reduce back-and-forth in DMs.",
      "Dispatch via scheduled LGA pooling clusters to protect merchant profit margins."
    ]
  },
  food: {
    headlines: [
      {
        title: "Repeat meal bundles & weekly pantry subscriptions seeing steady traction",
        summary: "Urban households are gravitating toward scheduled weekend delivery bundles to bypass market inflation.",
        signal: "Repeat Orders",
        howItHelpsYourBusiness: "Package staple combos (e.g. soup bowls + swallow) for repeat Friday deliveries."
      },
      {
        title: "WhatsApp conversational ordering winning over complex web checkouts",
        summary: "Local food vendors closing orders inside chat retain 68% more returning neighborhood buyers.",
        signal: "Customer Retention",
        howItHelpsYourBusiness: "Send instant Zukka checkout links directly in WhatsApp chat so buyers pay in one tap."
      },
      {
        title: "Packaging freshness and live dispatch tracking building buyer trust",
        summary: "Merchants using tamper-proof packaging and instant rider ETA updates see 90%+ 5-star ratings.",
        signal: "Trust & Reviews",
        howItHelpsYourBusiness: "Link orders directly to Chowdeck express dispatch for hot meals needing fast door-to-door transit."
      }
    ],
    insights: [
      "Keep daily batch counts visible on your stories to spark FOMO.",
      "Collect WhatsApp numbers for VIP weekly menu announcements.",
      "Use pooled morning dispatch for pre-orders to minimize delivery overhead."
    ]
  },
  beauty: {
    headlines: [
      {
        title: "Skincare buyers prioritizing ingredient transparency and visible before-and-after proof",
        summary: "Niacinamide, kojic acid, and barrier repair products are the fastest-growing search terms in West Africa.",
        signal: "Product Trend",
        howItHelpsYourBusiness: "Highlight certified active ingredients and share user testimonials to overcome buyer skepticism."
      },
      {
        title: "Micro-influencer styling demos outperforming static studio photos",
        summary: "Short user-generated routine videos are delivering 3x higher direct DM purchase requests.",
        signal: "Social Reach",
        howItHelpsYourBusiness: "Post 15-second texture and application clips with clear 'DM for price' triggers."
      },
      {
        title: "Quick DM response times directly deciding cosmetic purchasing decisions",
        summary: "Over 70% of beauty DM inquiries are lost if not acknowledged within 15 minutes.",
        signal: "Speed to Sale",
        howItHelpsYourBusiness: "Use Zukka Assisted Selling to immediately catch discount requests and approve within your safety floor."
      }
    ],
    insights: [
      "Create routine-based kits (Cleanser + Serum + SPF) for higher order values.",
      "Address common skin sensitivity concerns upfront in your drop captions.",
      "Offer mini travel sizes as checkout add-ons to lift revenue."
    ]
  },
  logistics: {
    headlines: [
      {
        title: "Fuel pricing fluctuations pushing delivery operators toward zone clustering",
        summary: "Last-mile courier costs are being stabilized through clustered drop-offs within high-density LGAs.",
        signal: "Cost Optimization",
        howItHelpsYourBusiness: "Group customer dispatches by LGA hub to maintain fixed low-cost shipping for buyers."
      },
      {
        title: "Automated payment settlement links accelerating dispatch turnarounds",
        summary: "Merchants waiting on manual bank transfer screenshots lose an average of 4 hours per dispatch cycle.",
        signal: "Cash Flow Velocity",
        howItHelpsYourBusiness: "Use Zukka Paystack dynamic links to instantly verify payments before handing packages to riders."
      },
      {
        title: "Real-time rider location sharing becoming an industry benchmark",
        summary: "Customers actively choose merchants that provide transparent delivery updates over silent dispatches.",
        signal: "Customer Experience",
        howItHelpsYourBusiness: "Leverage the integrated Chowdeck carrier grid for live dispatch telemetry."
      }
    ],
    insights: [
      "Set daily cutoff times for pooled deliveries to train buyer ordering habits.",
      "Keep express riders reserved for urgent, high-margin transactions.",
      "Communicate delivery timelines clearly at the moment of order confirmation."
    ]
  },
  health: {
    headlines: [
      {
        title: "Preventative wellness and daily supplement routines gaining massive consumer adoption",
        summary: "Shoppers are seeking trusted, verified sources for vitamins, teas, and nutritional supplements.",
        signal: "Wellness Demand",
        howItHelpsYourBusiness: "Offer monthly refill bundles to secure predictable recurring revenue from health-conscious customers."
      },
      {
        title: "Verified merchant authenticity driving purchase confidence in health retail",
        summary: "Trust badges and tamper-evident seals increase health product conversion by up to 45%.",
        signal: "Trust Score",
        howItHelpsYourBusiness: "Showcase your Zukka Trust Score prominently in your bio and social checkout links."
      },
      {
        title: "Temperature-controlled and careful handling becoming a buyer expectation",
        summary: "Customers expect health products to arrive undamaged and sealed against external heat.",
        signal: "Fulfillment Quality",
        howItHelpsYourBusiness: "Choose express dispatch for sensitive items to ensure rapid delivery without delays."
      }
    ],
    insights: [
      "Provide clear usage guidelines with every product dispatch.",
      "Highlight product expiry dates and authenticity seals in post captions.",
      "Follow up with buyers post-delivery to encourage recurring refills."
    ]
  },
  electronics: {
    headlines: [
      {
        title: "Refurbished and certified pre-owned tech witnessing unprecedented market interest",
        summary: "Foreign exchange rates have driven consumers to seek high-quality tested gadgets with warranties.",
        signal: "Value Demand",
        howItHelpsYourBusiness: "Offer clear 30-day merchant warranty badges on tech drops to close high-value sales quickly."
      },
      {
        title: "Fast video verification replacing showroom visits for gadgets",
        summary: "Buyers want a 30-second live test video of devices working before transferring funds.",
        signal: "Purchase Confidence",
        howItHelpsYourBusiness: "Upload battery health and screen test clips directly to your scheduled drop media."
      },
      {
        title: "Pay-in-installments & BNPL unlocking hesitant tech buyers",
        summary: "Installment options lift tech basket size by over 50% compared to lump-sum upfront payments.",
        signal: "Financing Access",
        howItHelpsYourBusiness: "Direct buyers toward the Zukka BNPL checkout pathway for split payments."
      }
    ],
    insights: [
      "Always include charger cables and accessories as a complimentary bonus to discourage haggling.",
      "Insist on instant Paystack digital confirmation to protect against fake transfer receipts.",
      "Use express rider delivery with live tracking for high-value gadget security."
    ]
  },
  general: {
    headlines: [
      {
        title: "Conversational commerce growing 3x faster than traditional Nigerian web stores",
        summary: "Buyers prefer chatting directly on WhatsApp and Instagram before making a purchase decision.",
        signal: "Social Commerce",
        howItHelpsYourBusiness: "Keep your social channels connected to Zukka to respond to buyer requests in real time."
      },
      {
        title: "Transparent instant checkout links eliminating manual receipt validation fraud",
        summary: "Fake transfer screenshots remain a leading risk for social merchants; automated links eliminate fraud.",
        signal: "Fraud Prevention",
        howItHelpsYourBusiness: "Never send raw personal bank accounts; generate a Zukka Paystack link for 100% verified settlement."
      },
      {
        title: "Clustered LGA delivery giving independent merchants big-retailer logistics efficiency",
        summary: "Independent sellers are matching major e-commerce delivery speeds by utilizing regional logistics pools.",
        signal: "Logistics Parity",
        howItHelpsYourBusiness: "Utilize Zukka express or eco-pool logistics to delight customers across Lagos and beyond."
      }
    ],
    insights: [
      "Keep your inventory prices and floor margins up-to-date for fast automated negotiations.",
      "Schedule social drops at peak evening browsing hours (7 PM - 9:30 PM) for maximum reach.",
      "Monitor your Zukka Trust Score to unlock higher customer conversion rates."
    ]
  }
};

function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
  console.log('[gemini.service] GEMINI_API_KEY present:', !!key);
  return key;
}

function isGoogleAiStudioKey(value: string | null): boolean {
  return !!value && /^AIza[0-9A-Za-z\-_]{30,}$/.test(value.trim());
}

function getGeminiModelCandidates(): string[] {
  const configured = (process.env.GEMINI_MODEL ?? "").trim();
  const preferred = [
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash-lite"
  ];

  if (!configured) {
    return preferred;
  }

  return [configured, ...preferred.filter((model) => model !== configured)];
}

function normalizeSectorName(sector?: string | null): string {
  if (!sector) return "general";
  const trimmed = sector.trim().toLowerCase();
  return trimmed in fallbackSectorTemplates ? trimmed : "general";
}

/**
 * Builds a curated sector news snapshot using static Nigerian retail market intelligence.
 */
export function buildFallbackSectorNewsSnapshot(sector: string): SectorNewsSnapshot {
  const normalizedSector = normalizeSectorName(sector);
  const displayName =
    normalizedSector === "general"
      ? "General Retail"
      : normalizedSector.charAt(0).toUpperCase() + normalizedSector.slice(1);
  const template =
    fallbackSectorTemplates[normalizedSector] ?? fallbackSectorTemplates.general;

  return {
    sector: displayName,
    generatedAt: new Date().toISOString(),
    headlines: template.headlines,
    insights: template.insights,
    nextUpdate: "Refreshes live on dashboard load",
    source: "curated-fallback"
  };
}

/**
 * Curates real-time sector news, market trends, and concrete business impact advice using Google Gemini.
 */
export async function fetchSectorNewsSnapshot(
  sector?: string | null,
  businessName?: string | null
): Promise<SectorNewsSnapshot> {
  const normalizedSector = normalizeSectorName(sector);
  const displayName =
    normalizedSector === "general"
      ? "General Retail"
      : normalizedSector.charAt(0).toUpperCase() + normalizedSector.slice(1);

  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    console.log(
      `[gemini.news] GEMINI_API_KEY not configured. Returning curated intelligence for ${displayName}.`
    );
    return buildFallbackSectorNewsSnapshot(normalizedSector);
  }

  if (!isGoogleAiStudioKey(apiKey)) {
    console.warn(
      `[gemini.news] GEMINI_API_KEY is not a valid Google AI Studio key (expected pattern: AIza...). Falling back to curated templates.`
    );
    return buildFallbackSectorNewsSnapshot(normalizedSector);
  }

  const modelCandidates = getGeminiModelCandidates();

  const prompt = `You are an elite retail commerce analyst specializing in Nigerian and West African informal social commerce (Instagram, WhatsApp, TikTok sellers in Lagos, Abuja, Port Harcourt).
Generate a concise, up-to-date market intelligence report for a merchant in the "${displayName}" sector${
    businessName ? ` named "${businessName}"` : ""
  }.

Provide:
1. Exactly 3 current, highly relevant market headlines/trends for this sector. For each item provide:
   - title: clear, compelling title.
   - summary: concise summary of the market shift or customer behavior (max 2 sentences).
   - signal: 1-3 word tag (e.g. "Demand Shift", "Pricing Tactic", "Logistics", "Trending").
   - howItHelpsYourBusiness: exactly how this merchant can take advantage of this right now to make more sales, protect profit margin, or convert social followers into paying customers (max 2 actionable sentences).
2. Exactly 3 high-impact strategic insights / tips for this merchant.

Return ONLY a valid JSON object matching this schema:
{
  "headlines": [
    {
      "title": "string",
      "summary": "string",
      "signal": "string",
      "howItHelpsYourBusiness": "string"
    }
  ],
  "insights": ["string", "string", "string"]
}`;

  let lastError: unknown = null;

  for (const model of modelCandidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    console.log(`[gemini.news] Trying model ${model} via v1beta endpoint.`);

    try {
      console.log(`[gemini.news] Requesting Gemini news curation for sector: ${displayName}`);

      const response = await axios.post(
        url,
        {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json"
          }
        },
        {
          timeout: 10000,
          headers: { "Content-Type": "application/json" }
        }
      );

      const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error("Empty response from Gemini API.");
      }

      const parsed = JSON.parse(rawText) as {
        headlines?: SectorNewsHeadline[];
        insights?: string[];
      };

      if (Array.isArray(parsed.headlines) && parsed.headlines.length > 0) {
        console.log(`[gemini.news] Successfully curated ${parsed.headlines.length} news items via Gemini using ${model}.`);
        return {
          sector: displayName,
          generatedAt: new Date().toISOString(),
          headlines: parsed.headlines.slice(0, 3).map((item) => ({
            title: item.title ?? "Market Trend",
            summary: item.summary ?? "",
            signal: item.signal ?? "Market Signal",
            howItHelpsYourBusiness:
              item.howItHelpsYourBusiness ??
              "Apply clear drop scheduling and fast checkout to capitalize on this buyer demand."
          })),
          insights:
            Array.isArray(parsed.insights) && parsed.insights.length > 0
              ? parsed.insights.slice(0, 3)
              : fallbackSectorTemplates[normalizedSector]?.insights ?? [],
          nextUpdate: "Refreshes live on dashboard load",
          source: "gemini-ai"
        };
      }

      throw new Error("Gemini response missing valid headlines array.");
    } catch (error) {
      lastError = error;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      console.warn(
        `[gemini.news] Model ${model} failed${status ? ` (${status})` : ""}. Trying next compatible model if available.`
      );
    }
  }

  console.warn(
    `[gemini.news] Gemini generation failed (${lastError instanceof Error ? lastError.message : "unknown"}). Falling back to curated templates.`
  );
  return buildFallbackSectorNewsSnapshot(normalizedSector);
}

const bargainMarkers =
  /\b(abeg|last price|less|discount|reduce|reduction|customer price|how much last|final price|cheaper|cut price|what is the price|best price|give me discount|oya drop price)\b/i;
const inquiryMarkers =
  /\b(available|in stock|still have|do you have|size|colour|color|original|real|authentic)\b/i;
const shippingMarkers =
  /\b(deliver|delivery|ship|shipping|dispatch|lekki|ikeja|abuja|waybill|pickup|rider)\b/i;
const paymentMarkers =
  /\b(pay|payment|account number|transfer|send link|checkout|how do i pay|bank|pos)\b/i;
const orderStatusMarkers =
  /\b(track|tracking|where is my|has it arrived|sent|dispatched|when will i get)\b/i;

const nairaAmountPattern =
  /(?:ngn|n)?\s?(\d{1,3}(?:[,\s]\d{3})+|\d{4,}|\d+(?:\.\d+)?)(?:\s?(?:naira|ngn|naira only|k))?/gi;

function extractLocalOfferPrice(messageText: string): number | undefined {
  const lowerMessage = messageText.toLowerCase();
  const offers: number[] = [];

  for (const match of lowerMessage.matchAll(nairaAmountPattern)) {
    const rawAmount = match[1]?.replace(/[,\s]/g, "");

    if (!rawAmount) {
      continue;
    }

    let parsedAmount = Number(rawAmount);
    const wholeMatch = match[0]?.toLowerCase() ?? "";

    if (wholeMatch.includes("k") && parsedAmount < 1000) {
      parsedAmount *= 1000;
    }

    if (Number.isFinite(parsedAmount) && parsedAmount > 0) {
      offers.push(parsedAmount);
    }
  }

  return offers.length > 0 ? Math.min(...offers) : undefined;
}

function fallbackAnalyzeCustomerIntent(
  messageText: string,
  _itemName: string,
  _currentPrice: number
): CustomerIntentAnalysis {
  const lowerMessage = messageText.toLowerCase();
  const detectsBargain = bargainMarkers.test(lowerMessage);
  const customerOfferPrice = extractLocalOfferPrice(messageText);

  let customerSentiment: CustomerSentiment = "neutral";
  if (/\b(scam|fake|angry|refund|report|bad|nonsense|wahala|complain|thief)\b/i.test(lowerMessage)) {
    customerSentiment = "negative_dispute";
  } else if (/\b(thanks|thank you|love|nice|perfect|okay|great|good|bless)\b/i.test(lowerMessage)) {
    customerSentiment = "positive";
  }

  let requestCategory: CustomerRequestCategory = "general_chat";
  if (detectsBargain) {
    requestCategory = "bargain_negotiation";
  } else if (paymentMarkers.test(lowerMessage)) {
    requestCategory = "payment_request";
  } else if (shippingMarkers.test(lowerMessage)) {
    requestCategory = "shipping_inquiry";
  } else if (inquiryMarkers.test(lowerMessage)) {
    requestCategory = "product_inquiry";
  } else if (orderStatusMarkers.test(lowerMessage)) {
    requestCategory = "order_status";
  }

  return {
    detectsBargain,
    customerOfferPrice,
    customerSentiment,
    requestCategory,
    summary: detectsBargain
      ? `Customer requested discount or haggled${customerOfferPrice ? ` (offered NGN ${customerOfferPrice})` : ""}`
      : `Customer sent a ${requestCategory.replace("_", " ")} request`
  };
}

/**
 * Analyzes inbound customer chat messages for commercial intent, pricing haggling, sentiment,
 * and request categories using Google Gemini (with local fallback).
 */
export async function analyzeCustomerIntent(
  messageText: string,
  itemName: string,
  currentPrice: number
): Promise<CustomerIntentAnalysis> {
  const trimmed = messageText.trim();
  if (!trimmed) {
    return {
      detectsBargain: false,
      customerSentiment: "neutral",
      requestCategory: "general_chat",
      summary: "Empty message"
    };
  }

  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    return fallbackAnalyzeCustomerIntent(trimmed, itemName, currentPrice);
  }

  if (!isGoogleAiStudioKey(apiKey)) {
    console.warn("[gemini.intent] GEMINI_API_KEY is not a valid Google AI Studio key; using local intent fallback.");
    return fallbackAnalyzeCustomerIntent(trimmed, itemName, currentPrice);
  }

  const modelCandidates = getGeminiModelCandidates();

  const prompt = `You are an expert conversational commerce analyzer for informal Nigerian Instagram and WhatsApp retail commerce.
Analyze this inbound customer message regarding the item "${itemName}" (listed price NGN ${currentPrice}):
"${trimmed}"

Tasks:
1. detectsBargain: boolean (true if buyer is haggling, asking for discount, last price, cheaper offer, or slang like "abeg", "last price", "customer price", "cut price").
2. customerOfferPrice: number or null (the specific price in Naira the customer proposed, if any. e.g. "pay 10k" -> 10000).
3. customerSentiment: "neutral" | "positive" | "negative_dispute".
4. requestCategory: "bargain_negotiation" | "product_inquiry" | "shipping_inquiry" | "payment_request" | "order_status" | "general_chat".
5. summary: A brief 1-sentence summary of what the customer wants.

Return ONLY a JSON object:
{
  "detectsBargain": boolean,
  "customerOfferPrice": number | null,
  "customerSentiment": "neutral" | "positive" | "negative_dispute",
  "requestCategory": "bargain_negotiation" | "product_inquiry" | "shipping_inquiry" | "payment_request" | "order_status" | "general_chat",
  "summary": "string"
}`;

  let lastError: unknown = null;

  for (const model of modelCandidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await axios.post(
        url,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        },
        {
          timeout: 8000,
          headers: { "Content-Type": "application/json" }
        }
      );

      const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        return fallbackAnalyzeCustomerIntent(trimmed, itemName, currentPrice);
      }

      const parsed = JSON.parse(rawText);
      const localOffer = extractLocalOfferPrice(trimmed);

      return {
        detectsBargain: Boolean(parsed.detectsBargain),
        customerOfferPrice:
          typeof parsed.customerOfferPrice === "number" && Number.isFinite(parsed.customerOfferPrice)
            ? parsed.customerOfferPrice
            : localOffer,
        customerSentiment: ["neutral", "positive", "negative_dispute"].includes(parsed.customerSentiment)
          ? parsed.customerSentiment
          : "neutral",
        requestCategory: [
          "bargain_negotiation",
          "product_inquiry",
          "shipping_inquiry",
          "payment_request",
          "order_status",
          "general_chat"
        ].includes(parsed.requestCategory)
          ? parsed.requestCategory
          : "general_chat",
        summary: typeof parsed.summary === "string" ? parsed.summary : "Customer inquiry"
      };
    } catch (error) {
      lastError = error;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      console.warn(
        `[gemini.intent] Model ${model} failed${status ? ` (${status})` : ""}; trying the next compatible Gemini model.`
      );
    }
  }

  console.warn("[gemini.intent] Gemini intent analysis fallback:", lastError instanceof Error ? lastError.message : lastError);
  return fallbackAnalyzeCustomerIntent(trimmed, itemName, currentPrice);
}
