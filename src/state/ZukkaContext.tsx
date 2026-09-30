import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import io from "socket.io-client";
import { createCheckoutOrder, getMetaConnectUrl, getMerchantDashboard, getMerchantChats, replyToChatMessage } from "../lib/api";

export type ChannelStatus = "connected" | "link" | "processing";
export type MessageChannel = "instagram" | "whatsapp";
export type DeliveryMethod = "express" | "eco_pool";
export type OrderStatus = "pending" | "paid" | "dispatched" | "completed";

export type InventoryItem = {
  id: string;
  title: string;
  photo: string;
  stock: number;
  basePrice: number;
  minFloor: number;
  category: string;
};

export type BargainStatus = "pending" | "approved" | "countered" | "declined";

export type ChatMessage = {
  id: string;
  customer: string;
  handle: string;
  channel: MessageChannel;
  text: string;
  createdAt: string;
  itemId?: string;
  media?: string;
  suggestedPrice?: number;
  approved?: boolean;
  status?: BargainStatus;
  direction?: "inbound" | "outbound";
};

export type Order = {
  id: string;
  ref: string;
  itemId: string;
  customer: string;
  lga: string;
  price: number;
  deliveryMethod: DeliveryMethod;
  status: OrderStatus;
  checkoutUrl: string;
};

export type ScheduledDrop = {
  id: string;
  caption: string;
  hashtags: string;
  media: string;
  scheduledFor: string;
};

type ZukkaContextValue = {
  channels: Record<string, ChannelStatus>;
  inventory: InventoryItem[];
  chats: ChatMessage[];
  orders: Order[];
  drops: ScheduledDrop[];
  selectedCheckoutRef: string;
  connectMeta: () => Promise<void>;
  addInventoryItem: (item: Omit<InventoryItem, "id">) => void;
  simulateBargainRequest: (media?: string) => ChatMessage;
  approveBargain: (messageId: string) => Promise<Order>;
  declineBargain: (messageId: string) => Promise<void>;
  sendReply: (chatId: string, messageText: string, counterPrice?: number) => Promise<void>;
  updateBargainRequest: (messageId: string, updates: Partial<ChatMessage>) => void;
  scheduleDrop: (drop: Omit<ScheduledDrop, "id">) => void;
  markOrderPaid: (ref: string) => void;
  setDeliveryMethod: (ref: string, method: DeliveryMethod) => void;
  refreshChats: () => Promise<void>;
};

const ZukkaContext = createContext<ZukkaContextValue | null>(null);

const nairaBag = "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=600&q=80";
const fashionRack = "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=600&q=80";
const slides = "https://images.unsplash.com/photo-1562273138-f46be4ebdf33?auto=format&fit=crop&w=600&q=80";
const headwrap = "https://images.unsplash.com/photo-1616559976488-01dbb8b492b6?auto=format&fit=crop&w=600&q=80";

const initialInventory: InventoryItem[] = [
  { id: "ankara-tote", title: "Ankara Tote Bag", photo: nairaBag, stock: 12, basePrice: 15000, minFloor: 11000, category: "Accessories" },
  { id: "linen-shirt", title: "Vintage Linen Shirt", photo: fashionRack, stock: 7, basePrice: 22000, minFloor: 18000, category: "Apparel" },
  { id: "beaded-slides", title: "Beaded Slides", photo: slides, stock: 24, basePrice: 9500, minFloor: 7500, category: "Footwear" },
  { id: "gele-wrap", title: "Gele Headwrap Set", photo: headwrap, stock: 18, basePrice: 6500, minFloor: 5000, category: "Occasionwear" }
];

const initialChats: ChatMessage[] = [
  {
    id: "chat-1",
    customer: "Zara O.",
    handle: "@zara_lagos",
    channel: "instagram",
    text: "Hey! Love the Ankara tote. Can I get 10% off?",
    createdAt: "09:41",
    itemId: "ankara-tote",
    suggestedPrice: 13500
  },
  {
    id: "chat-2",
    customer: "Kemi A.",
    handle: "+234 803 555 0142",
    channel: "whatsapp",
    text: "Bros abeg na 10% discount on the linen shirt na",
    createdAt: "09:46",
    itemId: "linen-shirt",
    suggestedPrice: 19800
  }
];

const initialOrders: Order[] = [
  {
    id: "order-1",
    ref: "ZUK-1002",
    itemId: "linen-shirt",
    customer: "Chidi M.",
    lga: "Lekki",
    price: 20000,
    deliveryMethod: "express",
    status: "dispatched",
    checkoutUrl: "https://zuka.shop/checkout/ZUK-1002"
  },
  {
    id: "order-2",
    ref: "ZUK-1003",
    itemId: "ankara-tote",
    customer: "Adaeze O.",
    lga: "Lekki",
    price: 13500,
    deliveryMethod: "eco_pool",
    status: "paid",
    checkoutUrl: "https://zuka.shop/checkout/ZUK-1003"
  },
  {
    id: "order-3",
    ref: "ZUK-1004",
    itemId: "beaded-slides",
    customer: "Funmi A.",
    lga: "Ikeja",
    price: 8550,
    deliveryMethod: "eco_pool",
    status: "paid",
    checkoutUrl: "https://zuka.shop/checkout/ZUK-1004"
  }
];

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export function ZukkaProvider({ children }: { children: ReactNode }) {
  const [channels, setChannels] = useState<Record<string, ChannelStatus>>({
    meta: "link",
    tiktok: "link",
    snapchat: "link"
  });
  const [inventory, setInventory] = useState(initialInventory);
  const [chats, setChats] = useState(initialChats);
  const [orders, setOrders] = useState(initialOrders);
  const [drops, setDrops] = useState<ScheduledDrop[]>([]);
  const [selectedCheckoutRef, setSelectedCheckoutRef] = useState("ZUK-1003");

  const refreshChats = useCallback(async () => {
    try {
      const resp = await getMerchantChats();
      if (Array.isArray(resp?.chats) && resp.chats.length > 0) {
        const formatted: ChatMessage[] = resp.chats.map((row) => ({
          id: row.id,
          customer: row.user_handle || row.external_user_id || "Customer",
          handle: row.user_handle || row.external_user_id || "customer",
          channel: row.platform,
          text: row.message_text,
          createdAt: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          direction: row.direction,
          status: row.sentiment_flag === "counteroffer_sent"
            ? "countered"
            : row.sentiment_flag === "checkout_link_sent"
              ? "approved"
              : undefined
        }));
        setChats(formatted);
      }
    } catch (err) {
      console.warn("[context] Could not fetch real chat history:", err);
    }
  }, []);

  const connectMeta = async () => {
    setChannels((current) => ({ ...current, meta: "processing" }));
    const popup = window.open("about:blank", "zukka_meta_connect", "width=600,height=720");

    try {
      if (!popup) {
        throw new Error("Unable to open the Meta onboarding window. Please allow popups for this site.");
      }

      const { connectUrl } = await getMetaConnectUrl();
      popup.location.href = connectUrl;
    } catch (error) {
      setChannels((current) => ({ ...current, meta: "link" }));
      if (popup && !popup.closed) {
        popup.close();
      }
      throw error;
    }
  };

  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "META_AUTH_SUCCESS") {
        setChannels((current) => ({ ...current, meta: "connected" }));
        void refreshChats();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [refreshChats]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const dashboard = await getMerchantDashboard();
        const merchantId = dashboard.merchant?.id;

        if (!merchantId) return;

        if (dashboard.merchant?.meta_connected) {
          setChannels((current) => ({ ...current, meta: "connected" }));
        }

        void refreshChats();

        const socketUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
        const socket = io(socketUrl, { transports: ["websocket"] });
        socketRef.current = socket;

        socket.on("connect", () => {
          socket.emit("join_merchant_room", { merchantId }, (ack: any) => {
            if (ack?.ok) {
              console.log("Joined merchant room", ack.room);
            }
          });
        });

        socket.on("inbound_chat", (payload: any) => {
          if (!mounted) return;

          const newMessage: ChatMessage = {
            id: payload.chatLogId || `chat-${Math.random().toString(36).slice(2, 9)}`,
            customer: payload.buyerHandle || "Social Customer",
            handle: payload.buyerHandle || payload.externalUserId || "social-user",
            channel: payload.channel === "whatsapp" ? "whatsapp" : "instagram",
            text: payload.messageText || `New message on ${payload.channel}`,
            createdAt: payload.createdAt || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            itemId: payload.itemId,
            suggestedPrice: payload.recommendedCounterOfferPrice ?? undefined,
            status: payload.detectsBargain ? "pending" : undefined,
            direction: "inbound"
          };

          setChats((current) => [newMessage, ...current.filter((c) => c.id !== newMessage.id)]);
        });

        socket.on("bargain_alert", (payload: any) => {
          if (!mounted) return;

          setChats((current) => {
            const existing = current.find((c) => c.id === payload.chatLogId);
            if (existing) {
              return current.map((c) =>
                c.id === payload.chatLogId
                  ? {
                      ...c,
                      itemId: payload.itemId ?? c.itemId,
                      suggestedPrice: payload.recommendedCounterOfferPrice ?? c.suggestedPrice,
                      status: "pending"
                    }
                  : c
              );
            }

            const message: ChatMessage = {
              id: payload.chatLogId || `chat-${Math.random().toString(36).slice(2, 9)}`,
              customer: payload.buyerHandle || "Social Customer",
              handle: payload.buyerHandle || payload.externalUserId || "social-user",
              channel: payload.channel === "whatsapp" ? "whatsapp" : "instagram",
              text: payload.messageText || `Bargain alert: ${payload.itemName}`,
              createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              itemId: payload.itemId,
              suggestedPrice: payload.recommendedCounterOfferPrice ?? undefined,
              status: "pending",
              direction: "inbound"
            };

            return [message, ...current];
          });
        });
      } catch (err) {
        // Not logged in or dashboard unavailable — ignore
      }
    })();

    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [refreshChats]);

  const addInventoryItem = (item: Omit<InventoryItem, "id">) => {
    setInventory((current) => [{ ...item, id: createId("item") }, ...current]);
  };

  const simulateBargainRequest = (media?: string) => {
    const item = inventory[0];
    const suggestedPrice = Math.max(Math.round(item.basePrice * 0.9), item.minFloor);
    const message: ChatMessage = {
      id: createId("chat"),
      customer: "Nkechi S.",
      handle: "@nkechi.styles",
      channel: "instagram",
      text: `Hello, can you ship to Lekki? Also can I get ${item.title} for ${formatNaira(suggestedPrice)}?`,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      itemId: item.id,
      media,
      suggestedPrice,
      direction: "inbound"
    };
    setChats((current) => [message, ...current]);
    return message;
  };

  const updateBargainRequest = (messageId: string, updates: Partial<ChatMessage>) => {
    setChats((current) => current.map((entry) => (entry.id === messageId ? { ...entry, ...updates } : entry)));
  };

  const declineBargain = async (messageId: string) => {
    const message = chats.find((entry) => entry.id === messageId);
    if (!message) return;

    try {
      await replyToChatMessage(messageId, "Thank you for your interest! Unfortunately we cannot offer a further discount on this item at this time.");
    } catch (err) {
      console.warn("[context.decline] Backend reply error:", err);
    }

    updateBargainRequest(messageId, {
      approved: false,
      status: "declined",
      text: `${message.text}\nMerchant reply: Offer declined.`
    });
  };

  const sendReply = async (chatId: string, messageText: string, counterPrice?: number) => {
    const message = chats.find((entry) => entry.id === chatId);
    if (!message) return;

    try {
      await replyToChatMessage(chatId, messageText, counterPrice);
    } catch (err) {
      console.warn("[context.reply] Backend reply failed, saving locally.", err);
    }

    updateBargainRequest(chatId, {
      suggestedPrice: counterPrice ?? message.suggestedPrice,
      approved: false,
      status: counterPrice ? "countered" : message.status,
      text: `${message.text}\nMerchant reply: ${messageText}`
    });
  };

  const approveBargain = async (messageId: string) => {
    const message = chats.find((entry) => entry.id === messageId);
    const item = inventory.find((entry) => entry.id === message?.itemId)
      ?? inventory.find((entry) => message?.text.toLowerCase().includes(entry.title.toLowerCase()))
      ?? inventory[0];
    const price = message?.suggestedPrice ?? Math.max(Math.round(item.basePrice * 0.9), item.minFloor);
    let order: Order;

    try {
      const checkout = await createCheckoutOrder({
        item_id: item.id,
        customer_phone: message?.handle ?? "social-customer",
        amount_naira: price,
        payment_method: "transfer",
        delivery_method: "eco_pool",
        delivery_lga: "Lekki",
        social_channel: message?.channel,
        external_user_id: message?.handle
      });
      const backendOrder = checkout.order;
      const ref = backendOrder.paystack_reference ?? backendOrder.id;

      order = {
        id: backendOrder.id,
        ref,
        itemId: backendOrder.item_id ?? item.id,
        customer: message?.customer ?? backendOrder.customer_phone,
        lga: backendOrder.delivery_lga,
        price: Number(backendOrder.amount_naira),
        deliveryMethod: backendOrder.delivery_method,
        status: backendOrder.payment_status === "paid" ? "paid" : "pending",
        checkoutUrl: checkout.checkout_link
      };
    } catch (error) {
      console.warn("[frontend.checkout] Backend checkout creation unavailable; using local fallback.", error);
      const ref = `ZUK-${Math.floor(100000 + Math.random() * 899999)}`;
      order = {
        id: createId("order"),
        ref,
        itemId: item.id,
        customer: message?.customer ?? "New Customer",
        lga: "Lekki",
        price,
        deliveryMethod: "eco_pool",
        status: "pending",
        checkoutUrl: `https://zukka.shop/checkout/${ref}`
      };
    }

    setOrders((current) => [order, ...current]);
    setSelectedCheckoutRef(order.ref);
    updateBargainRequest(messageId, {
      approved: true,
      status: "approved",
      text: `${message?.text ?? ""}\nMerchant reply: Checkout link ready ${order.checkoutUrl}`
    });
    return order;
  };

  const scheduleDrop = (drop: Omit<ScheduledDrop, "id">) => {
    setDrops((current) => [{ ...drop, id: createId("drop") }, ...current]);
  };

  const markOrderPaid = (ref: string) => {
    setOrders((current) => current.map((order) => (order.ref === ref ? { ...order, status: "paid" } : order)));
  };

  const setDeliveryMethod = (ref: string, method: DeliveryMethod) => {
    setOrders((current) => current.map((order) => (order.ref === ref ? { ...order, deliveryMethod: method } : order)));
  };

  const value = useMemo(
    () => ({
      channels,
      inventory,
      chats,
      orders,
      drops,
      selectedCheckoutRef,
      connectMeta,
      addInventoryItem,
      simulateBargainRequest,
      approveBargain,
      declineBargain,
      sendReply,
      updateBargainRequest,
      scheduleDrop,
      markOrderPaid,
      setDeliveryMethod,
      refreshChats
    }),
    [channels, inventory, chats, orders, drops, selectedCheckoutRef, refreshChats]
  );

  return <ZukkaContext.Provider value={value}>{children}</ZukkaContext.Provider>;
}

export function useZukka() {
  const context = useContext(ZukkaContext);
  if (!context) {
    throw new Error("useZukka must be used inside ZukkaProvider");
  }
  return context;
}

export function formatNaira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(value);
}
