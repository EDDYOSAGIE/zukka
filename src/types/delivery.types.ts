export interface AddressCoordinates {
  latitude: number;
  longitude: number;
}

export interface DeliveryFeeRequest {
  source_address?: AddressCoordinates;
  destination_address?: AddressCoordinates;

  source_address_string?: string;
  destination_address_string?: string;

  estimated_order_amount?: number;
}

export interface DeliveryFeeData {
  id?: number | string;
  fee_id?: number | string;
  total_amount?: number | string;
  delivery_fee?: number | string;
  amount?: number | string;
  delivery_amount?: number;
  service_amount?: number;
  safety_fee?: number;
}

export interface DeliveryFeeResponse {
  status: string;
  data: DeliveryFeeData;
}

export interface ContactDetails {
  name: string;
  phone: string;
  email?: string;
  country_code?: string;
}

export type UserAction = "sending" | "receiving";

export interface CreateDeliveryRequest {
  fee_id: number | string;
  reference?: string;
  item_type: string;
  user_action: UserAction;

  source_address?: AddressCoordinates;
  destination_address?: AddressCoordinates;

  source_contact: ContactDetails;
  destination_contact: ContactDetails;

  customer_delivery_note?: string;
  customer_vendor_note?: string;

  delivery_pin?: number;

  estimated_order_amount?: number;

  notification_channels?: (
    | "sms"
    | "email"
    | "whatsapp"
  )[];
}

export interface DeliveryData {
  id?: number | string;
  reference?: string;
  delivery_id?: number | string;
  delivery_reference?: string;
  delivery?: {
    id?: number | string;
    tracking_url?: string;
    trackingUrl?: string;
    status?: string;
  };
  delivery_price?: number;
  delivery_pin?: number | string;
  pin?: number | string;
  tracking_url?: string;
  trackingUrl?: string;
  status?: string;
}

export interface CreateDeliveryResponse {
  status: string;
  message: string;
  data: DeliveryData;
}

export interface GetDeliveryResponse {
  status: string;
  data: DeliveryData;
}