import type { DeliveryMethod } from "../state/ZukkaContext";
export const API_URL = import.meta.env.VITE_API_URL ?? '';
const apiBaseUrl = (import.meta.env.VITE_ZUKA_API_URL ?? "/api").replace(/\/$/, "");

type CreateCheckoutOrderRequest = {
  item_id: string;
  customer_phone: string;
  amount_naira: number;
  payment_method: "transfer" | "bnpl";
  delivery_method: DeliveryMethod;
  delivery_lga: string;
  social_channel?: "instagram" | "whatsapp";
  external_user_id?: string;
};

type CreateCheckoutOrderResponse = {
  order: {
    id: string;
    paystack_reference: string | null;
    item_id: string | null;
    customer_phone: string;
    amount_naira: number | string;
    delivery_method: DeliveryMethod;
    delivery_lga: string;
    payment_status: "pending" | "paid" | "failed_requires_refund";
    checkout_url: string | null;
  };
  checkout_link: string;
  social_delivery: string;
};

type MerchantAuthResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: string | number;
  merchant: {
    id: string;
    business_name: string;
    email: string;
    contact_phone: string;
    sector: string;
    zuka_trust_score: number;
    created_at: string;
  };
};

type MerchantDashboardResponse = {
  merchant: {
    id: string;
    business_name: string;
    sector?: string;
    zuka_trust_score: number;
    meta_connected?: boolean;
  };
  metrics: {
    gmv: number;
    completed_orders: number;
    delivery_integrity: string;
  };
  recent_orders: Array<{
    id: string;
    ref: string;
    amount_naira: number;
    payment_status: string;
    delivery_method: string;
    delivery_lga: string;
    created_at: string;
  }>;
  scheduled_drops: Array<{
    id: string;
    caption: string;
    hashtags: string;
    media: string;
    scheduledFor: string;
    status: string;
  }>;
  sector_news?: {
    sector: string;
    generatedAt: string;
    headlines: Array<{ title: string; summary: string; signal: string }>;
    insights: string[];
    nextUpdate: string;
  };
};

type AvailableRider = {
  id: string;
  full_name: string;
  phone: string;
  service_lga: string;
  vehicle_type: "bike" | "car" | "van";
  is_available: boolean;
};

type LoginMerchantPayload = {
  email: string;
  password: string;
};

type RegisterMerchantPayload = {
  business_name: string;
  email: string;
  phone: string;
  password: string;
  sector: string;
};

type CreateScheduledDropPayload = {
  caption: string;
  hashtags?: string;
  media_url: string;
  scheduled_for?: string | null;
  channel?: "instagram" | "whatsapp";
};

// We will rely on secure, httpOnly cookie-based sessions set by the backend.
// All requests that require authentication should include credentials so the
// browser sends cookies automatically. Avoid storing tokens in localStorage.

export async function isSessionActive(): Promise<boolean> {
  try {
    await getMerchantDashboard();
    return true;
  } catch (err) {
    return false;
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "message" in body && typeof body.message === "string"
      ? body.message
      : "Zuka API request failed.";
    throw new Error(message);
  }

  return body as T;
}

export async function loginMerchant(payload: LoginMerchantPayload): Promise<MerchantAuthResponse> {
  const response = await fetch(`${apiBaseUrl}/v1/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseApiResponse<MerchantAuthResponse>(response);
}

export async function registerMerchant(payload: RegisterMerchantPayload): Promise<MerchantAuthResponse> {
  const response = await fetch(`${apiBaseUrl}/v1/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseApiResponse<MerchantAuthResponse>(response);
}

export async function logoutMerchant(): Promise<{ ok: boolean; message: string }> {
  const response = await fetch(`${apiBaseUrl}/v1/auth/logout`, {
    method: "POST",
    credentials: "include"
  });

  return parseApiResponse<{ ok: boolean; message: string }>(response);
}

type MetaConnectResponse = {
  connectUrl: string;
};

export async function getMetaConnectUrl(): Promise<MetaConnectResponse> {
  const response = await fetch(`${apiBaseUrl}/v1/meta/connect`, {
    method: "GET",
    credentials: "include"
  });

  return parseApiResponse<MetaConnectResponse>(response);
}

export async function createCheckoutOrder(payload: CreateCheckoutOrderRequest): Promise<CreateCheckoutOrderResponse> {
  const response = await fetch(`${apiBaseUrl}/v1/orders/checkout`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseApiResponse<CreateCheckoutOrderResponse>(response);
}

export async function getMerchantDashboard(): Promise<MerchantDashboardResponse> {
  const response = await fetch(`${apiBaseUrl}/v1/merchant/dashboard`, {
    method: "GET",
    credentials: "include"
  });

  return parseApiResponse<MerchantDashboardResponse>(response);
}

export async function createScheduledDrop(payload: CreateScheduledDropPayload): Promise<{ drop: MerchantDashboardResponse["scheduled_drops"][number] }> {
  const response = await fetch(`${apiBaseUrl}/v1/merchant/drops`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseApiResponse<{ drop: MerchantDashboardResponse["scheduled_drops"][number] }>(response);
}

export async function requestPasswordReset(email: string): Promise<{ ok: boolean; message: string; resetToken?: string }> {
  const response = await fetch(`${apiBaseUrl}/v1/auth/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email })
  });

  return parseApiResponse<{ ok: boolean; message: string; resetToken?: string }>(response);
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<{ ok: boolean; message: string }> {
  const response = await fetch(`${apiBaseUrl}/v1/auth/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ token, newPassword })
  });

  return parseApiResponse<{ ok: boolean; message: string }>(response);
}

export async function initializePaystackPayment(params: {
  orderId?: string;
  amountNaira: number;
  customerPhone?: string;
  email?: string;
}): Promise<{ ok: boolean; authorization_url?: string; access_code?: string; reference?: string; simulated?: boolean; message?: string }> {
  const response = await fetch(`${apiBaseUrl}/v1/orders/paystack/initialize`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(params)
  });

  return parseApiResponse<{ ok: boolean; authorization_url?: string; access_code?: string; reference?: string; simulated?: boolean; message?: string }>(response);
}

export async function verifyPaystackPayment(reference: string): Promise<{ ok: boolean; status: string; message: string; order?: unknown }> {
  const response = await fetch(`${apiBaseUrl}/v1/orders/paystack/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    credentials: "include"
  });

  return parseApiResponse<{ ok: boolean; status: string; message: string; order?: unknown }>(response);
}

export async function getMerchantChats(): Promise<{ chats: Array<{ id: string; merchant_id?: string; platform: "instagram" | "whatsapp"; external_user_id?: string; user_handle?: string; message_text: string; direction?: "inbound" | "outbound"; sentiment_flag?: string; created_at: string }> }> {
  const response = await fetch(`${apiBaseUrl}/v1/merchant/chats`, {
    method: "GET",
    credentials: "include"
  });

  return parseApiResponse<{ chats: Array<{ id: string; merchant_id?: string; platform: "instagram" | "whatsapp"; external_user_id?: string; user_handle?: string; message_text: string; direction?: "inbound" | "outbound"; sentiment_flag?: string; created_at: string }> }>(response);
}

export async function replyToChatMessage(chatId: string, messageText: string, suggestedPrice?: number): Promise<{ ok: boolean; message?: string; chatId?: string }> {
  const response = await fetch(`${apiBaseUrl}/v1/merchant/chats/${encodeURIComponent(chatId)}/reply`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ messageText, suggestedPrice })
  });

  return parseApiResponse<{ ok: boolean; message?: string; chatId?: string }>(response);
}

export async function getDeliveryByOrder(orderId: string): Promise<{ success: boolean; data?: Record<string, unknown>; message?: string }> {
  const response = await fetch(`${apiBaseUrl}/delivery/order/${encodeURIComponent(orderId)}`, {
    method: "GET",
    credentials: "include"
  });

  return parseApiResponse<{ success: boolean; data?: Record<string, unknown>; message?: string }>(response);
}

export async function listAvailableRiders(lga: string): Promise<AvailableRider[]> {
  const response = await fetch(`${apiBaseUrl}/v1/riders/available?lga=${encodeURIComponent(lga)}`, { credentials: "include" });
  const body = await parseApiResponse<{ riders: AvailableRider[] }>(response);
  return body.riders;
}
