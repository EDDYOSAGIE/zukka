import { Request, Response } from "express";
import { supabase } from "../lib/supabase";

type OnboardRiderBody = {
  full_name?: string;
  phone?: string;
  service_lga?: string;
  vehicle_type?: "bike" | "car" | "van";
  is_available?: boolean;
};

type RiderRow = {
  id: string;
  full_name: string;
  phone: string;
  service_lga: string;
  vehicle_type: "bike" | "car" | "van";
  is_available: boolean;
  created_at: string;
};

export async function onboardRider(req: Request<object, object, OnboardRiderBody>, res: Response) {
  console.log("[riders.onboard] Creating rider availability profile.");

  const fullName = req.body.full_name?.trim();
  const phone = req.body.phone?.trim();
  const serviceLga = req.body.service_lga?.trim();
  const vehicleType = req.body.vehicle_type ?? "bike";
  const isAvailable = req.body.is_available ?? true;

  if (!fullName || !phone || !serviceLga) {
    return res.status(400).json({
      error: "missing_rider_fields",
      message: "full_name, phone, and service_lga are required."
    });
  }

  const { data, error } = await supabase
    .from("riders")
    .insert({
      full_name: fullName,
      phone,
      service_lga: serviceLga,
      vehicle_type: vehicleType,
      is_available: isAvailable
    })
    .select("id,full_name,phone,service_lga,vehicle_type,is_available,created_at")
    .single<RiderRow>();

  if (error || !data) {
    console.error("[riders.onboard] Failed to onboard rider.", error);
    return res.status(500).json({
      error: "rider_onboarding_failed",
      message: "Unable to onboard rider."
    });
  }

  return res.status(201).json({ rider: data });
}

export async function listAvailableRiders(req: Request<object, object, object, { lga?: string }>, res: Response) {
  const lga = req.query.lga?.trim();

  if (!lga) {
    return res.status(400).json({
      error: "missing_lga",
      message: "lga query parameter is required."
    });
  }

  console.log(`[riders.available] Searching available riders for ${lga}.`);

  const { data, error } = await supabase
    .from("riders")
    .select("id,full_name,phone,service_lga,vehicle_type,is_available,created_at")
    .ilike("service_lga", lga)
    .eq("is_available", true)
    .order("created_at", { ascending: true })
    .returns<RiderRow[]>();

  if (error) {
    console.error(`[riders.available] Rider availability lookup failed for ${lga}.`, error);
    return res.status(500).json({
      error: "rider_lookup_failed",
      message: "Unable to retrieve available riders."
    });
  }

  return res.status(200).json({
    lga,
    riders: data ?? []
  });
}
