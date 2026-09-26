// Backward-compatibility bridge: forward all AI calls to Gemini service
export {
  analyzeCustomerIntent,
  fetchSectorNewsSnapshot,
  buildFallbackSectorNewsSnapshot as buildSectorNewsSnapshot
} from "./geminiService";

export type {
  CustomerIntentAnalysis,
  CustomerSentiment,
  CustomerRequestCategory,
  SectorNewsHeadline,
  SectorNewsSnapshot
} from "./geminiService";
