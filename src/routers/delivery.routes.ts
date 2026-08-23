import { Router } from "express";

import {
  getDeliveryFee,
  createDelivery,
  getDeliveryStatus,
  getDeliveryQuote,
  getDeliveryByOrder,
  getDeliveryById,
  getMerchantDeliveries,
  updateDeliveryStatus,
  refreshDeliveryStatus,
  cancelDelivery,
} from "../controllers/delivery.controller";

const router = Router();

router.post(
  "/fee",
  getDeliveryFee
);

router.post(
  "/",
  createDelivery
);

router.get(
  "/:reference",
  getDeliveryStatus
);


router.post(
  "/quote/:orderId",
  getDeliveryQuote
);


router.get(
  "/order/:orderId",
  getDeliveryByOrder
);

router.get(
  "/merchant/:merchantId",
  getMerchantDeliveries
);

router.get(
  "/:deliveryId",
  getDeliveryById
);

router.get(
  "/:deliveryId/refresh",
  refreshDeliveryStatus
);

router.put(
  "/:deliveryId/status",
  updateDeliveryStatus
);

router.delete(
  "/:deliveryId",
  cancelDelivery
);

export default router;




