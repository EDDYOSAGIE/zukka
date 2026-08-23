import axios, { AxiosInstance } from "axios";

import {
  DeliveryFeeRequest,
  DeliveryFeeResponse,
  CreateDeliveryRequest,
  CreateDeliveryResponse,
  GetDeliveryResponse,
} from "../types/delivery.types";

class ChowdeckService {
  private client: AxiosInstance;

  constructor() {
    const apiKey = process.env.CHOWDECK_API_KEY;
    const baseURL = process.env.CHOWDECK_BASE_URL;

    if (!apiKey) {
      throw new Error("CHOWDECK_API_KEY is not configured");
    }

    if (!baseURL) {
      throw new Error("CHOWDECK_BASE_URL is not configured");
    }

    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15000,
    });
  }

  /**
   * Get delivery fee quote
   */
  async getDeliveryFee(
    payload: DeliveryFeeRequest
  ): Promise<DeliveryFeeResponse> {
    const response = await this.client.post<DeliveryFeeResponse>(
      "/relay/delivery/fee",
      payload
    );

    return response.data;
  }

  /**
   * Create actual delivery
   */
  async createDelivery(
    payload: CreateDeliveryRequest
  ): Promise<CreateDeliveryResponse> {
    const response = await this.client.post<CreateDeliveryResponse>(
      "/relay/delivery",
      payload
    );

    return response.data;
  }

  /**
   * Get delivery status
   */
  async getDelivery(
    reference: string
  ): Promise<GetDeliveryResponse> {
    const response = await this.client.get<GetDeliveryResponse>(
      `/relay/delivery/${reference}`
    );

    return response.data;
  }

  async getDeliveryStatus(
    payload: { deliveryId?: string | null; reference?: string | null }
  ): Promise<GetDeliveryResponse> {
    const reference = payload.reference ?? payload.deliveryId ?? "";
    return this.getDelivery(reference);
  }

  async cancelDelivery(
    payload: { deliveryId?: string | null; reference?: string | null }
  ): Promise<{ status: string; message?: string; data?: unknown }> {
    const reference = payload.reference ?? payload.deliveryId ?? "";
    const response = await this.client.post(
      `/relay/delivery/${reference}/cancel`,
      payload
    );

    return response.data;
  }
}

export default new ChowdeckService();