import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import chowdeckService from "../services/chowdeck.service";

/**
 * ============================================================
 * TYPES
 * ============================================================
 */

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    merchantId?: string;
  };
}

interface DeliveryQuoteRequest {
  orderId: string;
}

interface CreateDeliveryRequest {
  orderId: string;
}

interface UpdateDeliveryStatusRequest {
  status: string;
}


/**
 * ============================================================
 * HELPER FUNCTIONS
 * ============================================================
 */

const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  error?: unknown
): void => {
  console.error(message, error);

  res.status(statusCode).json({
    success: false,
    message,
  });
};


/**
 * Get a complete order with merchant information.
 */
export const getDeliveryFee = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      source_address,
      destination_address,
      source_address_string,
      destination_address_string,
      estimated_order_amount,
    } = req.body;

    if (
      !source_address &&
      !source_address_string
    ) {
      res.status(400).json({
        success: false,
        message: "Source address is required",
      });
      return;
    }

    if (
      !destination_address &&
      !destination_address_string
    ) {
      res.status(400).json({
        success: false,
        message: "Destination address is required",
      });
      return;
    }

    const result =
      await chowdeckService.getDeliveryFee({
        source_address,
        destination_address,
        source_address_string,
        destination_address_string,
        estimated_order_amount,
      });

    res.status(200).json({
      success: true,
      message: "Delivery fee calculated successfully",
      data: result.data,
    });
  } catch (error: any) {
    console.error(
      "Chowdeck fee error:",
      error.response?.data || error.message
    );

    res.status(
      error.response?.status || 500
    ).json({
      success: false,
      message:
        error.response?.data?.message ||
        "Failed to calculate delivery fee",
    });
  }
};

const getOrderWithMerchant = async (orderId: string) => {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      merchants (
        id,
        business_name,
        contact_phone,
        email,
        business_address,
        business_latitude,
        business_longitude
      )
    `)
    .eq("id", orderId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};


export const getDeliveryQuote = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      sendError(
        res,
        400,
        "Order ID is required"
      );
      return;
    }

    const order = await getOrderWithMerchant(orderId);

    if (!order) {
      sendError(
        res,
        404,
        "Order not found"
      );
      return;
    }

    /**
     * Make sure the order has not already been delivered.
     */
    if (
      order.order_status === "delivered"
    ) {
      sendError(
        res,
        400,
        "Delivery quote cannot be generated for a delivered order"
      );
      return;
    }

    /**
     * Customer destination coordinates
     */
    if (
      order.delivery_latitude === null ||
      order.delivery_latitude === undefined ||
      order.delivery_longitude === null ||
      order.delivery_longitude === undefined
    ) {
      sendError(
        res,
        400,
        "Customer delivery coordinates are required"
      );
      return;
    }

    /**
     * Merchant pickup coordinates
     */
    const merchant = order.merchants;

    if (!merchant) {
      sendError(
        res,
        400,
        "Merchant information is missing"
      );
      return;
    }

    if (
      merchant.business_latitude === null ||
      merchant.business_latitude === undefined ||
      merchant.business_longitude === null ||
      merchant.business_longitude === undefined
    ) {
      sendError(
        res,
        400,
        "Merchant pickup coordinates are not configured"
      );
      return;
    }

    /**
     * Convert naira → kobo.
     *
     * Example:
     * ₦10,000 → 1,000,000 kobo
     */
    const estimatedOrderAmount =
      Math.round(
        Number(order.amount_naira) * 100
      );

    /**
     * Ask Chowdeck for delivery quote.
     */
    const quote =
      await chowdeckService.getDeliveryFee({
        source_address: {
          latitude: Number(
            merchant.business_latitude
          ),
          longitude: Number(
            merchant.business_longitude
          ),
        },

        destination_address: {
          latitude: Number(
            order.delivery_latitude
          ),
          longitude: Number(
            order.delivery_longitude
          ),
        },

        estimated_order_amount:
          estimatedOrderAmount,
      });

    /**
     * Adapt these fields to the exact response
     * returned by your Chowdeck Relay service.
     */
    const feeData = quote?.data;

    if (!feeData) {
      sendError(
        res,
        502,
        "Chowdeck did not return a delivery quote"
      );
      return;
    }

    const feeId =
      feeData.id ??
      feeData.fee_id;

    const totalAmount =
      feeData.total_amount ??
      feeData.delivery_fee ??
      feeData.amount;

    if (!feeId) {
      sendError(
        res,
        502,
        "Chowdeck response did not contain a fee ID"
      );
      return;
    }

    if (
      totalAmount === undefined ||
      totalAmount === null
    ) {
      sendError(
        res,
        502,
        "Chowdeck response did not contain a delivery fee"
      );
      return;
    }

    /**
     * Chowdeck amount is assumed to be in kobo.
     */
    const deliveryFeeNaira =
      Number(totalAmount) / 100;

    /**
     * Save quote against the order.
     */
    const { data: updatedOrder, error: updateError } =
      await supabase
        .from("orders")
        .update({
          delivery_fee_naira:
            deliveryFeeNaira,

          delivery_fee_id:
            String(feeId),

          delivery_fee_quoted_at:
            new Date().toISOString(),

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", orderId)
        .select()
        .single();

    if (updateError) {
      sendError(
        res,
        500,
        "Delivery quote was received but could not be saved",
        updateError
      );
      return;
    }

    /**
     * Calculate customer-facing total.
     */
    const productAmount =
      Number(order.amount_naira);

    const totalOrderAmount =
      productAmount +
      deliveryFeeNaira;

    res.status(200).json({
      success: true,

      message:
        "Delivery quote retrieved successfully",

      data: {
        orderId,

        product_amount_naira:
          productAmount,

        delivery_fee_naira:
          deliveryFeeNaira,

        total_amount_naira:
          totalOrderAmount,

        fee_id:
          String(feeId),

        order:
          updatedOrder,
      },
    });

  } catch (error: any) {
    sendError(
      res,
      error?.response?.status || 500,
      error?.response?.data?.message ||
        error?.message ||
        "Failed to calculate delivery fee",
      error
    );
  }
};


/**
 * ============================================================
 * 2. CREATE CHOWDECK DELIVERY
 * ============================================================
 *
 * POST /api/delivery
 *
 * IMPORTANT:
 *
 * This should ONLY be called after Paystack has confirmed
 * that the order has been paid.
 */

export const createDelivery = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { orderId } =
      req.body as CreateDeliveryRequest;

    if (!orderId) {
      sendError(
        res,
        400,
        "Order ID is required"
      );
      return;
    }

    /**
     * Get order + merchant.
     */
    const order =
      await getOrderWithMerchant(orderId);

    if (!order) {
      sendError(
        res,
        404,
        "Order not found"
      );
      return;
    }

    /**
     * SECURITY:
     *
     * Never create a delivery based on the frontend saying
     * payment succeeded.
     *
     * The database must say paid.
     */
    if (
      order.payment_status !== "paid"
    ) {
      sendError(
        res,
        400,
        "Order must be paid before delivery can be created"
      );
      return;
    }

    /**
     * Check whether delivery already exists.
     *
     * This protects against duplicate delivery creation.
     */
    const {
      data: existingDelivery,
      error: existingError,
    } = await supabase
      .from("deliveries")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existingError) {
      sendError(
        res,
        500,
        "Failed to check existing delivery",
        existingError
      );
      return;
    }

    if (existingDelivery) {
      res.status(200).json({
        success: true,
        message:
          "Delivery already exists",

        data: existingDelivery,
      });

      return;
    }

    /**
     * A fee_id should have been generated before payment.
     */
    if (!order.delivery_fee_id) {
      sendError(
        res,
        400,
        "Delivery fee has not been calculated for this order"
      );
      return;
    }

    const merchant =
      order.merchants;

    if (!merchant) {
      sendError(
        res,
        400,
        "Merchant information is missing"
      );
      return;
    }

    /**
     * Validate merchant location.
     */
    if (
      merchant.business_latitude === null ||
      merchant.business_latitude === undefined ||
      merchant.business_longitude === null ||
      merchant.business_longitude === undefined
    ) {
      sendError(
        res,
        400,
        "Merchant pickup location is missing"
      );
      return;
    }

    /**
     * Validate customer location.
     */
    if (
      order.delivery_latitude === null ||
      order.delivery_latitude === undefined ||
      order.delivery_longitude === null ||
      order.delivery_longitude === undefined
    ) {
      sendError(
        res,
        400,
        "Customer delivery location is missing"
      );
      return;
    }

    /**
     * Create unique Zukka reference.
     */
    const reference =
      `ZUKKA-${order.id}`;


    /**
     * Send request to Chowdeck Relay.
     *
     * IMPORTANT:
     *
     * The exact property names here MUST match the
     * Chowdeck Relay API/service implementation you have.
     */
    const chowdeckResponse =
      await chowdeckService.createDelivery({

        fee_id:
          String(order.delivery_fee_id),

        reference,

        item_type: "order",
        user_action: "sending",

        source_contact: {
          name:
            merchant.business_name,

          phone:
            merchant.contact_phone,

          email:
            merchant.email,

          country_code:
            "NG",
        },

        destination_contact: {
          name:
            order.customer_name ||
            "Zukka Customer",

          phone:
            order.customer_phone,

          email:
            order.customer_email ||
            undefined,

          country_code:
            "NG",
        },

        source_address: {
          latitude:
            Number(
              merchant.business_latitude
            ),

          longitude:
            Number(
              merchant.business_longitude
            ),
        },

        destination_address: {
          latitude:
            Number(
              order.delivery_latitude
            ),

          longitude:
            Number(
              order.delivery_longitude
            ),
        },

        customer_delivery_note:
          order.delivery_address,

        estimated_order_amount:
          Math.round(
            Number(
              order.amount_naira
            ) * 100
          ),
      });

    const deliveryData =
      chowdeckResponse?.data;

    if (!deliveryData) {
      sendError(
        res,
        502,
        "Chowdeck did not return delivery information"
      );
      return;
    }

    /**
     * Extract provider information.
     *
     * Adapt these names to your exact Relay response.
     */
    const providerDeliveryId =
      deliveryData.id ??
      deliveryData.delivery_id ??
      deliveryData.delivery?.id;

    const providerReference =
      deliveryData.reference ??
      deliveryData.delivery_reference ??
      reference;

    const trackingUrl =
      deliveryData.tracking_url ??
      deliveryData.trackingUrl ??
      deliveryData.delivery?.tracking_url ??
      null;

    const deliveryPin =
      deliveryData.delivery_pin ??
      deliveryData.pin ??
      null;

    const providerStatus =
      deliveryData.status ??
      "preparing";


    /**
     * Insert delivery into Supabase.
     */
    const {
      data: delivery,
      error: deliveryError,
    } = await supabase
      .from("deliveries")
      .insert({
        order_id:
          order.id,

        provider:
          "chowdeck",

        provider_delivery_id:
          providerDeliveryId
            ? String(providerDeliveryId)
            : null,

        provider_reference:
          providerReference,

        fee_id:
          String(order.delivery_fee_id),

        delivery_fee_naira:
          Number(
            order.delivery_fee_naira || 0
          ),

        estimated_order_amount_naira:
          Number(
            order.amount_naira
          ),

        status:
          providerStatus,

        tracking_url:
          trackingUrl,

        delivery_pin:
          deliveryPin
            ? String(deliveryPin)
            : null,

        source_name:
          merchant.business_name,

        source_phone:
          merchant.contact_phone,

        source_address:
          merchant.business_address,

        source_latitude:
          merchant.business_latitude,

        source_longitude:
          merchant.business_longitude,

        destination_name:
          order.customer_name ||
          "Zukka Customer",

        destination_phone:
          order.customer_phone,

        destination_address:
          order.delivery_address,

        destination_latitude:
          order.delivery_latitude,

        destination_longitude:
          order.delivery_longitude,

        customer_delivery_note:
          order.delivery_address,

        created_at:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      })
      .select()
      .single();

    if (deliveryError) {
      /**
       * IMPORTANT:
       *
       * Chowdeck delivery may already have been created even
       * though saving to Supabase failed.
       *
       * Log this carefully so it can be reconciled rather
       * than blindly retrying and creating another delivery.
       */
      console.error(
        "Chowdeck delivery created but Supabase insert failed:",
        deliveryError
      );

      res.status(500).json({
        success: false,

        message:
          "Delivery was created with the provider but could not be saved locally. Manual reconciliation may be required.",

        provider_reference:
          providerReference,
      });

      return;
    }


    /**
     * Update order status.
     */
    const {
      error: orderUpdateError,
    } = await supabase
      .from("orders")
      .update({
        order_status:
          "ready_for_delivery",

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", order.id);

    if (orderUpdateError) {
      console.error(
        "Delivery saved but order status update failed:",
        orderUpdateError
      );
    }


    res.status(201).json({
      success: true,

      message:
        "Delivery created successfully",

      data: delivery,
    });

  } catch (error: any) {

    console.error(
      "Create delivery error:",
      error?.response?.data ||
        error?.message ||
        error
    );

    sendError(
      res,
      error?.response?.status || 500,

      error?.response?.data?.message ||
        error?.message ||
        "Failed to create delivery",

      error
    );
  }
};


/**
 * ============================================================
 * 3. GET DELIVERY BY ORDER
 * ============================================================
 *
 * GET /api/delivery/order/:orderId
 */

export const getDeliveryByOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { orderId } =
      req.params;

    if (!orderId) {
      sendError(
        res,
        400,
        "Order ID is required"
      );
      return;
    }

    const {
      data: delivery,
      error,
    } = await supabase
      .from("deliveries")
      .select(`
        *,
        orders (
          id,
          merchant_id,
          amount_naira,
          payment_status,
          order_status,
          customer_name,
          customer_phone,
          customer_email,
          delivery_address,
          delivery_lga,
          delivery_latitude,
          delivery_longitude,
          delivery_fee_naira,
          created_at
        )
      `)
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) {
      sendError(
        res,
        500,
        "Failed to retrieve delivery",
        error
      );
      return;
    }

    if (!delivery) {
      res.status(404).json({
        success: false,
        message:
          "No delivery found for this order",
      });

      return;
    }

    res.status(200).json({
      success: true,
      data: delivery,
    });

  } catch (error) {
    sendError(
      res,
      500,
      "Failed to retrieve delivery",
      error
    );
  }
};


/**
 * ============================================================
 * 4. GET DELIVERY BY ID
 * ============================================================
 *
 * GET /api/delivery/:deliveryId
 */

export const getDeliveryById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { deliveryId } =
      req.params;

    if (!deliveryId) {
      sendError(
        res,
        400,
        "Delivery ID is required"
      );
      return;
    }

    const {
      data: delivery,
      error,
    } = await supabase
      .from("deliveries")
      .select(`
        *,
        orders (
          id,
          merchant_id,
          amount_naira,
          payment_status,
          order_status,
          customer_name,
          customer_phone,
          customer_email,
          delivery_address,
          delivery_lga,
          delivery_latitude,
          delivery_longitude,
          delivery_fee_naira,
          created_at
        )
      `)
      .eq("id", deliveryId)
      .single();

    if (error) {
      if (
        error.code === "PGRST116"
      ) {
        sendError(
          res,
          404,
          "Delivery not found"
        );
        return;
      }

      sendError(
        res,
        500,
        "Failed to retrieve delivery",
        error
      );

      return;
    }

    res.status(200).json({
      success: true,
      data: delivery,
    });

  } catch (error) {
    sendError(
      res,
      500,
      "Failed to retrieve delivery",
      error
    );
  }
};


/**
 * ============================================================
 * 5. GET ALL DELIVERIES FOR A MERCHANT
 * ============================================================
 *
 * GET /api/delivery/merchant/:merchantId
 */

export const getMerchantDeliveries = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { merchantId } =
      req.params;

    if (!merchantId) {
      sendError(
        res,
        400,
        "Merchant ID is required"
      );
      return;
    }

    const {
      data: deliveries,
      error,
    } = await supabase
      .from("deliveries")
      .select(`
        *,
        orders (
          id,
          item_id,
          amount_naira,
          payment_status,
          order_status,
          customer_name,
          customer_phone,
          delivery_address,
          delivery_lga,
          delivery_fee_naira,
          created_at
        )
      `)
      .eq(
        "orders.merchant_id",
        merchantId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

    if (error) {
      sendError(
        res,
        500,
        "Failed to retrieve merchant deliveries",
        error
      );

      return;
    }

    res.status(200).json({
      success: true,

      count:
        deliveries?.length || 0,

      data:
        deliveries || [],
    });

  } catch (error) {
    sendError(
      res,
      500,
      "Failed to retrieve merchant deliveries",
      error
    );
  }
};


/**
 * ============================================================
 * 6. UPDATE DELIVERY STATUS
 * ============================================================
 *
 * PUT /api/delivery/:deliveryId/status
 *
 * This endpoint should ideally be protected and should
 * normally be called by your webhook/service rather than
 * blindly trusting the frontend.
 */

export const updateDeliveryStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { deliveryId } =
      req.params;

    const { status } =
      req.body as UpdateDeliveryStatusRequest;

    if (!deliveryId) {
      sendError(
        res,
        400,
        "Delivery ID is required"
      );
      return;
    }

    if (!status) {
      sendError(
        res,
        400,
        "Delivery status is required"
      );
      return;
    }

    const validStatuses = [
      "pending",
      "quoted",
      "preparing",
      "awaiting_pickup",
      "in_transit",
      "delivered",
      "failed",
      "cancelled",
    ];

    if (
      !validStatuses.includes(status)
    ) {
      sendError(
        res,
        400,
        "Invalid delivery status"
      );
      return;
    }

    /**
     * First retrieve the delivery so we know
     * which order it belongs to.
     */
    const {
      data: existingDelivery,
      error: findError,
    } = await supabase
      .from("deliveries")
      .select(`
        id,
        order_id,
        status
      `)
      .eq("id", deliveryId)
      .single();

    if (findError) {
      if (
        findError.code === "PGRST116"
      ) {
        sendError(
          res,
          404,
          "Delivery not found"
        );
        return;
      }

      sendError(
        res,
        500,
        "Failed to find delivery",
        findError
      );

      return;
    }

    /**
     * Update delivery.
     */
    const updatePayload: Record<
      string,
      unknown
    > = {
      status,

      updated_at:
        new Date().toISOString(),
    };

    if (
      status === "delivered"
    ) {
      updatePayload.delivered_at =
        new Date().toISOString();
    }

    const {
      data: delivery,
      error: updateError,
    } = await supabase
      .from("deliveries")
      .update(updatePayload)
      .eq("id", deliveryId)
      .select()
      .single();

    if (updateError) {
      sendError(
        res,
        500,
        "Failed to update delivery",
        updateError
      );

      return;
    }

    /**
     * Keep the order status synchronized.
     */
    let orderStatus:
      | string
      | null = null;

    switch (status) {
      case "preparing":
        orderStatus =
          "processing";
        break;

      case "awaiting_pickup":
        orderStatus =
          "ready_for_delivery";
        break;

      case "in_transit":
        orderStatus =
          "out_for_delivery";
        break;

      case "delivered":
        orderStatus =
          "delivered";
        break;

      case "cancelled":
        orderStatus =
          "cancelled";
        break;

      case "failed":
        orderStatus =
          "failed";
        break;
    }

    if (orderStatus) {
      const {
        error: orderError,
      } = await supabase
        .from("orders")
        .update({
          order_status:
            orderStatus,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          existingDelivery.order_id
        );

      if (orderError) {
        console.error(
          "Delivery updated but order status failed:",
          orderError
        );
      }
    }

    res.status(200).json({
      success: true,

      message:
        "Delivery status updated successfully",

      data: delivery,
    });

  } catch (error) {
    sendError(
      res,
      500,
      "Failed to update delivery status",
      error
    );
  }
};


/**
 * ============================================================
 * 7. REFRESH DELIVERY STATUS FROM CHOWDECK
 * ============================================================
 *
 * GET /api/delivery/:deliveryId/refresh
 *
 * This asks Chowdeck for the current delivery state,
 * then synchronizes Supabase.
 */

export const refreshDeliveryStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { deliveryId } =
      req.params;

    if (!deliveryId) {
      sendError(
        res,
        400,
        "Delivery ID is required"
      );
      return;
    }

    /**
     * Get local delivery.
     */
    const {
      data: delivery,
      error,
    } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", deliveryId)
      .single();

    if (error) {
      if (
        error.code === "PGRST116"
      ) {
        sendError(
          res,
          404,
          "Delivery not found"
        );
        return;
      }

      sendError(
        res,
        500,
        "Failed to retrieve delivery",
        error
      );

      return;
    }

    if (
      !delivery.provider_delivery_id &&
      !delivery.provider_reference
    ) {
      sendError(
        res,
        400,
        "Delivery does not have a provider reference"
      );

      return;
    }

    /**
     * Ask Chowdeck for current status.
     *
     * You need to make sure your service implements this
     * method using the correct Relay endpoint.
     */
    const providerResponse =
      await chowdeckService.getDeliveryStatus({
        deliveryId:
          delivery.provider_delivery_id,

        reference:
          delivery.provider_reference,
      });

    const providerData =
      providerResponse?.data;

    if (!providerData) {
      sendError(
        res,
        502,
        "Chowdeck did not return delivery status"
      );

      return;
    }

    const newStatus =
      providerData.status ??
      delivery.status;

    const trackingUrl =
      providerData.tracking_url ??
      providerData.trackingUrl ??
      delivery.tracking_url;

    const deliveryPin =
      providerData.delivery_pin ??
      providerData.pin ??
      delivery.delivery_pin;

    /**
     * Update local delivery.
     */
    const {
      data: updatedDelivery,
      error: updateError,
    } = await supabase
      .from("deliveries")
      .update({
        status:
          newStatus,

        tracking_url:
          trackingUrl,

        delivery_pin:
          deliveryPin
            ? String(deliveryPin)
            : null,

        updated_at:
          new Date().toISOString(),

        ...(newStatus === "delivered"
          ? {
              delivered_at:
                delivery.delivered_at ||
                new Date().toISOString(),
            }
          : {}),
      })
      .eq("id", deliveryId)
      .select()
      .single();

    if (updateError) {
      sendError(
        res,
        500,
        "Failed to synchronize delivery status",
        updateError
      );

      return;
    }

    /**
     * Synchronize order.
     */
    let orderStatus:
      | string
      | null = null;

    switch (newStatus) {
      case "preparing":
        orderStatus =
          "processing";
        break;

      case "awaiting_pickup":
        orderStatus =
          "ready_for_delivery";
        break;

      case "in_transit":
        orderStatus =
          "out_for_delivery";
        break;

      case "delivered":
        orderStatus =
          "delivered";
        break;

      case "cancelled":
        orderStatus =
          "cancelled";
        break;

      case "failed":
        orderStatus =
          "failed";
        break;
    }

    if (orderStatus) {
      await supabase
        .from("orders")
        .update({
          order_status:
            orderStatus,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          delivery.order_id
        );
    }

    res.status(200).json({
      success: true,

      message:
        "Delivery status synchronized",

      data:
        updatedDelivery,
    });

  } catch (error: any) {
    sendError(
      res,
      error?.response?.status || 500,

      error?.response?.data?.message ||
        error?.message ||
        "Failed to refresh delivery status",

      error
    );
  }
};


/**
 * ============================================================
 * 8. CANCEL DELIVERY
 * ============================================================
 *
 * DELETE /api/delivery/:deliveryId
 *
 * This should only be enabled if the Chowdeck Relay API
 * supports cancelling an existing delivery.
 */

export const cancelDelivery = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { deliveryId } =
      req.params;

    if (!deliveryId) {
      sendError(
        res,
        400,
        "Delivery ID is required"
      );
      return;
    }

    const {
      data: delivery,
      error,
    } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", deliveryId)
      .single();

    if (error) {
      if (
        error.code === "PGRST116"
      ) {
        sendError(
          res,
          404,
          "Delivery not found"
        );
        return;
      }

      sendError(
        res,
        500,
        "Failed to retrieve delivery",
        error
      );

      return;
    }

    /**
     * Do not cancel an already delivered order.
     */
    if (
      delivery.status === "delivered"
    ) {
      sendError(
        res,
        400,
        "A delivered order cannot be cancelled"
      );

      return;
    }

    /**
     * Call Chowdeck cancellation endpoint if supported.
     */
    if (
      delivery.provider_delivery_id ||
      delivery.provider_reference
    ) {
      try {
        await chowdeckService.cancelDelivery({
          deliveryId:
            delivery.provider_delivery_id,

          reference:
            delivery.provider_reference,
        });
      } catch (providerError) {
        console.error(
          "Chowdeck cancellation failed:",
          providerError
        );

        sendError(
          res,
          502,
          "Unable to cancel delivery with Chowdeck",
          providerError
        );

        return;
      }
    }

    /**
     * Update local delivery.
     */
    const {
      data: updatedDelivery,
      error: updateError,
    } = await supabase
      .from("deliveries")
      .update({
        status:
          "cancelled",

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", deliveryId)
      .select()
      .single();

    if (updateError) {
      sendError(
        res,
        500,
        "Delivery was cancelled with provider but local update failed",
        updateError
      );

      return;
    }

    /**
     * Update order.
     */
    await supabase
      .from("orders")
      .update({
        order_status:
          "cancelled",

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        delivery.order_id
      );

    res.status(200).json({
      success: true,

      message:
        "Delivery cancelled successfully",

      data:
        updatedDelivery,
    });

  } catch (error) {
    sendError(
      res,
      500,
      "Failed to cancel delivery",
      error
    );
  }
};

/**
 * Get delivery status
 */
export const getDeliveryStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { reference } = req.params;

    if (!reference) {
      res.status(400).json({
        success: false,
        message: "Delivery reference is required",
      });
      return;
    }

    const result =
      await chowdeckService.getDelivery(reference);

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    console.error(
      "Chowdeck tracking error:",
      error.response?.data || error.message
    );

    res.status(
      error.response?.status || 500
    ).json({
      success: false,
      message:
        error.response?.data?.message ||
        "Failed to retrieve delivery",
    });
  }
};


/**
 * ============================================================
 * EXPORTS
 * ============================================================
 */

export default {
  getDeliveryQuote,
  createDelivery,
  getDeliveryByOrder,
  getDeliveryById,
  getMerchantDeliveries,
  getDeliveryFee,
  getDeliveryStatus,
  updateDeliveryStatus,
  refreshDeliveryStatus,
  cancelDelivery,
};