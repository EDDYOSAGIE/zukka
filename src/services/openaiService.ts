import OpenAI from "openai";

export type CustomerSentiment = "neutral" | "positive" | "negative_dispute";

export type CustomerIntentAnalysis = {
  detectsBargain: boolean;
  customerOfferPrice?: number;
  customerSentiment: CustomerSentiment;
};

export type SectorNewsHeadline = {
  title: string;
  summary: string;
  signal: string;
};

export type SectorNewsSnapshot = {
  sector: string;
  generatedAt: string;
  headlines: SectorNewsHeadline[];
  insights: string[];
  nextUpdate: string;
};

const fallbackSectorTemplates: Record<string, { headlines: SectorNewsHeadline[]; insights: string[] }> = {
  fashion: {
    headlines: [
      {
        title: "Fashion demand is shifting toward value-led capsule dressing",
        summary: "Shoppers are prioritising versatile pieces and clear pricing over impulse buys.",
        signal: "Demand"
      },
      {
        title: "Fashion creators are leaning into social proof-led launches",
        summary: "Short drop windows and creator styling posts are improving conversion in metro markets.",
        signal: "Reach"
      },
      {
        title: "Fast delivery is becoming a differentiator for repeat fashion buyers",
        summary: "Flexible pooled delivery is helping merchants protect margin while staying competitive.",
        signal: "Fulfilment"
      }
    ],
    insights: [
      "Watch for demand spikes in everyday staples and low-friction accessories.",
      "Pair each drop with a clear offer so buyers can act quickly.",
      "Use local delivery windows to reduce order drop-off."
    ]
  },
  food: {
    headlines: [
      {
        title: "Food demand is moving toward convenience and repeat-buy bundles",
        summary: "Households are responding well to value bundles and proactive reorder reminders.",
        signal: "Demand"
      },
      {
        title: "Local food sellers are using social chat to drive same-day repeat orders",
        summary: "Fast answers and clear pickup windows keep conversion strong across neighbourhood markets.",
        signal: "Engagement"
      },
      {
        title: "Inventory freshness and delivery reliability are shaping trust",
        summary: "Merchants that communicate stock status and timing win more repeat purchases.",
        signal: "Operations"
      }
    ],
    insights: [
      "Feature bundles and refill offers to encourage repeat demand.",
      "Keep stock visibility consistent so buyers do not lose confidence.",
      "Use location-based messaging to shorten decision time."
    ]
  },
  beauty: {
    headlines: [
      {
        title: "Beauty buyers are responding to trusted recommendations and visible results",
        summary: "Social proof, before-and-after context, and clear use cases are lifting conversion.",
        signal: "Demand"
      },
      {
        title: "Beauty discovery is still highly visual and community-driven",
        summary: "Short-form video and ambassador-led reviews are improving discovery and trust.",
        signal: "Reach"
      },
      {
        title: "Fast feedback loops matter more in beauty than in broad retail",
        summary: "Quick responses to questions and order changes reduce hesitation at checkout.",
        signal: "Conversion"
      }
    ],
    insights: [
      "Show proof of use and social validation on every product story.",
      "Match product bundles to the buyer's routine to increase basket size.",
      "Respond to questions quickly so buyers feel guided rather than sold to."
    ]
  },
  logistics: {
    headlines: [
      {
        title: "Logistics buyers are prioritising predictable delivery and live visibility",
        summary: "Shippers are rewarding operators that communicate ETAs and exceptions early.",
        signal: "Demand"
      },
      {
        title: "Pooling and route planning are becoming stronger margin tools",
        summary: "Regional pooling is helping operators reduce empty miles and protect margins.",
        signal: "Operations"
      },
      {
        title: "Operational transparency is becoming part of the value proposition",
        summary: "Customers want proof that a delivery partner can be trusted across different zones.",
        signal: "Trust"
      }
    ],
    insights: [
      "Use route clarity and ETA updates to build confidence with customers.",
      "Highlight pooling and consolidation where it improves speed and cost.",
      "Monitor missed delivery windows and fix them quickly."
    ]
  },
  general: {
    headlines: [
      {
        title: "General market activity remains active with steady buyer engagement",
        summary: "Merchants that keep their offer clear, their response time quick, and their delivery promise realistic are staying competitive.",
        signal: "Overview"
      },
      {
        title: "Regional buyers are rewarding clear value communication",
        summary: "A concise offer, simple checkout, and reliable fulfilment are still the strongest levers.",
        signal: "Conversion"
      },
      {
        title: "Smart merchants are using data to match demand with local routes",
        summary: "A localised approach to messaging and delivery is helping capture more repeat purchase intent.",
        signal: "Strategy"
      }
    ],
    insights: [
      "Keep demand signals visible so your team can respond quickly.",
      "Review your delivery promise and adjust it to local buyer expectations.",
      "Use your sector focus to steer content and product positioning."
    ]
  }
};

function normalizeSectorName(sector: string): string {
  const trimmed = sector.trim().toLowerCase();
  return trimmed in fallbackSectorTemplates ? trimmed : "general";
}

export function buildSectorNewsSnapshot(sector: string): SectorNewsSnapshot {
  const normalizedSector = normalizeSectorName(sector);
  const displayName = normalizedSector === "general" ? "General" : normalizedSector.charAt(0).toUpperCase() + normalizedSector.slice(1);
  const template = fallbackSectorTemplates[normalizedSector] ?? fallbackSectorTemplates.general;

  return {
    sector: displayName,
    generatedAt: new Date().toISOString(),
    headlines: template.headlines.map((headline) => ({
      ...headline,
      title: headline.title.replace("{sector}", displayName)
    })),
    insights: template.insights.map((insight) => insight.replace("{sector}", displayName)),
    nextUpdate: "Refreshed on every sign-in"
  };
}

type CustomerIntentModelResponse = {
  detectsBargain?: boolean;
  customerOfferPrice?: number | null;
  customerSentiment?: CustomerSentiment;
};

const openAiApiKey = process.env.OPENAI_API_KEY;

const openai = openAiApiKey
  ? new OpenAI({
      apiKey: openAiApiKey
    })
  : null;

const bargainMarkers = /\b(abeg|last price|less|discount|reduce|reduction|customer price|how much last|final price|cheaper|cut price|what is the price|best price)\b/i;
const nairaAmountPattern = /(?:ngn|n)?\s?(\d{1,3}(?:[,\s]\d{3})+|\d{4,}|\d+(?:\.\d+)?)(?:\s?(?:naira|ngn|naira only|k))?/gi;

function parseJsonObject(content: string): CustomerIntentModelResponse {
  const fencedJson = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const rawJson = fencedJson ?? content;
  const firstBrace = rawJson.indexOf("{");
  const lastBrace = rawJson.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("OpenAI response did not contain a JSON object.");
  }

  return JSON.parse(rawJson.slice(firstBrace, lastBrace + 1)) as CustomerIntentModelResponse;
}

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

function fallbackAnalyzeCustomerIntent(messageText: string): CustomerIntentAnalysis {
  const detectsBargain = bargainMarkers.test(messageText);
  const customerOfferPrice = extractLocalOfferPrice(messageText);
  const lowerMessage = messageText.toLowerCase();
  const customerSentiment: CustomerSentiment =
    /\b(scam|fake|angry|refund|report|bad|nonsense|wahala|complain)\b/i.test(lowerMessage)
      ? "negative_dispute"
      : /\b(thanks|thank you|love|nice|perfect|okay|great|good)\b/i.test(lowerMessage)
        ? "positive"
        : "neutral";

  return {
    detectsBargain,
    customerOfferPrice,
    customerSentiment
  };
}

function normalizeAnalysis(response: CustomerIntentModelResponse, messageText: string): CustomerIntentAnalysis {
  const localOfferPrice = extractLocalOfferPrice(messageText);
  const sentiment = response.customerSentiment;

  return {
    detectsBargain: Boolean(response.detectsBargain),
    customerOfferPrice:
      typeof response.customerOfferPrice === "number" && Number.isFinite(response.customerOfferPrice)
        ? response.customerOfferPrice
        : localOfferPrice,
    customerSentiment:
      sentiment === "positive" || sentiment === "negative_dispute" || sentiment === "neutral"
        ? sentiment
        : "neutral"
  };
}

export async function analyzeCustomerIntent(
  messageText: string,
  itemName: string,
  currentPrice: number
): Promise<CustomerIntentAnalysis> {
  if (!messageText.trim()) {
    return {
      detectsBargain: false,
      customerSentiment: "neutral"
    };
  }

  if (!openai) {
    console.warn("[openai.intent] OPENAI_API_KEY is not configured. Using deterministic local fallback.");
    return fallbackAnalyzeCustomerIntent(messageText);
  }

  try {
    console.log("[openai.intent] Sending customer message for commerce intent analysis.");

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert conversational commerce analyzer for informal Nigerian Instagram and WhatsApp retail channels. Scan buyer messages for haggling, discount requests, lower-price offers, and slang markers such as 'abeg', 'last price', 'less', 'customer price', and 'sis reduction'. Return only JSON with detectsBargain boolean, customerOfferPrice number or null, and customerSentiment as one of neutral, positive, negative_dispute."
        },
        {
          role: "user",
          content: JSON.stringify({
            messageText,
            itemName,
            currentPriceNaira: currentPrice
          })
        }
      ]
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      console.warn("[openai.intent] Empty model response. Falling back to deterministic analyzer.");
      return fallbackAnalyzeCustomerIntent(messageText);
    }

    return normalizeAnalysis(parseJsonObject(content), messageText);
  } catch (error) {
    console.error("[openai.intent] Model analysis failed. Falling back to deterministic analyzer.", error);
    return fallbackAnalyzeCustomerIntent(messageText);
  }
}
