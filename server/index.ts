import express from "express";
import { handleInboundMetaWebhook, handlePaystackFulfillmentWebhook } from "./controllers/webhooks";

const app = express();

app.use(express.json({ limit: "50mb" }));

app.post("/webhooks/meta/inbound", handleInboundMetaWebhook);
app.post("/webhooks/paystack/fulfillment", handlePaystackFulfillmentWebhook);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "zukka-api" });
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`Zukka API listening on ${port}`);
});
