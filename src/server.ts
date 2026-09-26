import "dotenv/config";
import http from "node:http";
import cors from "cors";
import express, { Request, Response } from "express";
import { Server, Socket } from "socket.io";
import { forgotPassword, loginMerchant, logoutMerchant, registerMerchant, resetPassword } from "./controllers/authController";
import { checkoutRoutes } from "./controllers/checkoutController";
import { createMerchantDrop, getMerchantDashboard } from "./controllers/dashboardController";
import {
  getMetaConnectUrl,
  handleMetaCallback,
  receiveMetaWebhook,
  verifyMetaWebhook,
  handleMetaFinalize,
  getMerchantChats,
  replyToChat,
  syncMetaConversations
} from "./controllers/metaController";
import {
  handlePaystackWebhook,
  initializePaystackPaymentRoute,
  verifyPaystackPayment
} from "./controllers/paystackController";
import { listAvailableRiders, onboardRider } from "./controllers/riderController";
import { setRealtimeServer } from "./lib/realtime";
import { authenticateToken } from "./middleware/auth";
import deliveryRoutes from "./routers/delivery.routes";


type JoinMerchantRoomPayload = {
  merchantId?: string;
};

const port = Number(process.env.PORT ?? 8080);
const webhookRawBodyPath = "/v1/webhooks/paystack";

export const app = express();
export const httpServer = http.createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Paystack-Signature"]
  }
});
setRealtimeServer(io);

app.disable("x-powered-by");

const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5173";
app.use(
  "/api/delivery",
  deliveryRoutes
);
app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Paystack-Signature"]
  })
);

app.use((req, res, next) => {
  if (req.path === webhookRawBodyPath) {
    console.log("[server.bootstrap] Preserving raw Paystack webhook body.");
    return express.raw({ type: "application/json", limit: "50mb" })(req, res, next);
  }

  return express.json({ limit: "50mb" })(req, res, next);
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: "zuka-core-api",
    realtime: "socket.io",
    timestamp: new Date().toISOString()
  });
});

app.post("/v1/auth/register", registerMerchant);
app.post("/v1/auth/login", loginMerchant);
app.post("/v1/auth/logout", logoutMerchant);
app.post("/v1/auth/forgot-password", forgotPassword);
app.post("/v1/auth/reset-password", resetPassword);
app.get("/v1/meta/connect", authenticateToken, getMetaConnectUrl);
app.get("/v1/meta/callback", authenticateToken, handleMetaCallback);
app.post("/v1/meta/finalize", authenticateToken, handleMetaFinalize);
app.post("/v1/meta/sync", authenticateToken, syncMetaConversations);
app.get("/v1/merchant/dashboard", authenticateToken, getMerchantDashboard);
app.get("/v1/merchant/chats", authenticateToken, getMerchantChats);
app.post("/v1/merchant/chats/:chatId/reply", authenticateToken, replyToChat);
app.post("/v1/merchant/drops", authenticateToken, createMerchantDrop);
app.get("/v1/webhooks/meta", verifyMetaWebhook);
app.post("/v1/webhooks/meta", receiveMetaWebhook);
app.post(webhookRawBodyPath, handlePaystackWebhook);
app.post("/v1/orders/checkout", authenticateToken, checkoutRoutes.createCheckoutOrder);
app.post("/v1/orders/paystack/initialize", initializePaystackPaymentRoute);
app.get("/v1/orders/paystack/verify/:reference", verifyPaystackPayment);
app.post("/v1/riders", onboardRider);
app.get("/v1/riders/available", listAvailableRiders);

io.on("connection", (socket: Socket) => {
  console.log(`[socket] Client connected: ${socket.id}.`);

  socket.on("join_merchant_room", (payload: JoinMerchantRoomPayload, acknowledgement?: (response: object) => void) => {
    const merchantId = payload?.merchantId?.trim();

    if (!merchantId) {
      console.warn(`[socket] ${socket.id} attempted to join without merchantId.`);
      acknowledgement?.({
        ok: false,
        error: "merchant_id_required"
      });
      return;
    }

    const roomCode = `merchant_${merchantId}`;
    socket.join(roomCode);
    console.log(`[socket] ${socket.id} joined secure merchant room ${roomCode}.`);

    acknowledgement?.({
      ok: true,
      room: roomCode
    });
  });

  socket.on("disconnect", (reason) => {
    console.log(`[socket] Client disconnected: ${socket.id}. Reason: ${reason}.`);
  });
});

httpServer.listen(port, () => {
  console.log(`[server.bootstrap] Zuka Core API listening on port ${port}.`);
  console.log("[server.bootstrap] Express JSON parser enabled for standard routes.");
  console.log(`[server.bootstrap] Raw body preservation enabled for ${webhookRawBodyPath}.`);
});
