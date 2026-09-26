import bcrypt from "bcryptjs";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import { Request, Response } from "express";
import { supabase } from "../lib/supabase";

type MerchantRow = {
  id: string;
  business_name: string;
  contact_phone: string;
  email: string;
  password_hash: string;
  sector: string | null;
  zuka_trust_score: number;
  created_at: string;
};

type RegisterMerchantBody = {
  business_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  sector?: string;
};

type LoginMerchantBody = {
  email?: string;
  password?: string;
};

const jwtExpiresIn: SignOptions["expiresIn"] = "24h";

function getJwtSecret(): Secret {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required for merchant authentication.");
  }

  return jwtSecret;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return phone.trim();
}

function normalizeSector(sector?: string): string {
  const normalized = sector?.trim().toLowerCase();

  if (normalized === "fashion" || normalized === "food" || normalized === "beauty" || normalized === "logistics" || normalized === "health" || normalized === "electronics") {
    return normalized;
  }

  return "general";
}

function signMerchantToken(merchantId: string): string {
  return jwt.sign({ merchantId }, getJwtSecret(), { expiresIn: jwtExpiresIn });
}

function setSessionCookie(res: Response, accessToken: string) {
  res.cookie("zuka_session", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000
  });
}

function toAuthPayload(merchant: MerchantRow, accessToken: string) {
  return {
    accessToken,
    tokenType: "Bearer",
    expiresIn: jwtExpiresIn,
    merchant: {
      id: merchant.id,
      business_name: merchant.business_name,
      email: merchant.email,
      contact_phone: merchant.contact_phone,
      sector: merchant.sector ?? "general",
      zuka_trust_score: merchant.zuka_trust_score,
      created_at: merchant.created_at
    }
  };
}

export async function registerMerchant(req: Request<object, object, RegisterMerchantBody>, res: Response) {
  console.log("[auth.register] Incoming merchant registration request.");

  const businessName = req.body.business_name?.trim();
  const email = req.body.email ? normalizeEmail(req.body.email) : "";
  const contactPhone = req.body.phone ? normalizePhone(req.body.phone) : "";
  const password = req.body.password;
  const sector = normalizeSector(req.body.sector);

  if (!businessName || !email || !contactPhone || !password || !req.body.sector?.trim()) {
    console.warn("[auth.register] Registration rejected because required fields are missing.");
    return res.status(400).json({
      error: "missing_required_fields",
      message: "business_name, email, phone, password, and sector are required."
    });
  }

  if (password.length < 8) {
    console.warn("[auth.register] Registration rejected because password is too short.");
    return res.status(400).json({
      error: "weak_password",
      message: "Password must be at least 8 characters long."
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    console.log("[auth.register] Password hashed successfully. Creating merchant record.");

    const { data, error } = await supabase
      .from("merchants")
      .insert({
        business_name: businessName,
        email,
        contact_phone: contactPhone,
        password_hash: passwordHash,
        sector
      })
      .select("id,business_name,contact_phone,email,password_hash,sector,zuka_trust_score,created_at")
      .single<MerchantRow>();

    if (error || !data) {
      console.error("[auth.register] Supabase insert failed.", error);
      const isDuplicate = error?.code === "23505";

      return res.status(isDuplicate ? 409 : 500).json({
        error: isDuplicate ? "merchant_already_exists" : "merchant_registration_failed",
        message: isDuplicate
          ? "A merchant with this email or phone number already exists."
          : "Unable to register merchant at this time."
      });
    }

    const accessToken = signMerchantToken(data.id);
    setSessionCookie(res, accessToken);
    console.log(`[auth.register] Merchant ${data.id} registered and token issued.`);

    return res.status(201).json(toAuthPayload(data, accessToken));
  } catch (error) {
    console.error("[auth.register] Unexpected registration failure.", error);

    return res.status(500).json({
      error: "unexpected_registration_error",
      message: "Unable to complete merchant registration."
    });
  }
}

export async function logoutMerchant(_req: Request, res: Response) {
  res.clearCookie("zuka_session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  return res.status(200).json({
    ok: true,
    message: "Signed out successfully."
  });
}

export async function loginMerchant(req: Request<object, object, LoginMerchantBody>, res: Response) {
  console.log("[auth.login] Incoming merchant login request.");

  const email = req.body.email ? normalizeEmail(req.body.email) : "";
  const password = req.body.password;

  if (!email || !password) {
    console.warn("[auth.login] Login rejected because credentials are incomplete.");
    return res.status(400).json({
      error: "missing_credentials",
      message: "email and password are required."
    });
  }

  try {
    const { data, error } = await supabase
      .from("merchants")
      .select("id,business_name,contact_phone,email,password_hash,sector,zuka_trust_score,created_at")
      .eq("email", email)
      .maybeSingle<MerchantRow>();

    if (error) {
      console.error("[auth.login] Supabase lookup failed.", error);
      return res.status(500).json({
        error: "merchant_lookup_failed",
        message: "Unable to validate merchant credentials at this time."
      });
    }

    if (!data) {
      console.warn(`[auth.login] Login failed because merchant email ${email} was not found.`);
      return res.status(401).json({
        error: "invalid_credentials",
        message: "No merchant account matches the supplied email and password."
      });
    }

    const passwordMatches = await bcrypt.compare(password, data.password_hash);

    if (!passwordMatches) {
      console.warn(`[auth.login] Login failed because password hash did not match for merchant ${data.id}.`);
      return res.status(401).json({
        error: "invalid_credentials",
        message: "No merchant account matches the supplied email and password."
      });
    }

    const accessToken = signMerchantToken(data.id);
    setSessionCookie(res, accessToken);
    console.log(`[auth.login] Merchant ${data.id} authenticated and token issued.`);

    return res.status(200).json(toAuthPayload(data, accessToken));
  } catch (error) {
    console.error("[auth.login] Unexpected login failure.", error);

    return res.status(500).json({
      error: "unexpected_login_error",
      message: "Unable to complete merchant login."
    });
  }
}

function getPublicAppUrl(): string {
  return (process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
}

export async function forgotPassword(req: Request<object, object, { email?: string }>, res: Response) {
  const email = req.body.email ? normalizeEmail(req.body.email) : "";

  if (!email) {
    return res.status(400).json({
      error: "missing_email",
      message: "Please provide the email address associated with your merchant account."
    });
  }

  try {
    const { data: merchant, error } = await supabase
      .from("merchants")
      .select("id,business_name,email")
      .eq("email", email)
      .maybeSingle<{ id: string; business_name: string; email: string }>();

    if (error) {
      console.error("[auth.forgotPassword] Database query failed:", error);
      return res.status(500).json({
        error: "lookup_failed",
        message: "Unable to process password reset at this time."
      });
    }

    if (!merchant) {
      console.log(`[auth.forgotPassword] No account found for ${email}. Returning generic response for security.`);
      return res.status(200).json({
        ok: true,
        message: "If an account matches this email, instructions to reset your password have been sent."
      });
    }

    // Generate a secure reset token valid for 1 hour
    const resetToken = jwt.sign(
      { merchantId: merchant.id, email: merchant.email, purpose: "password_reset" },
      getJwtSecret(),
      { expiresIn: "1h" }
    );

    const resetLink = `${getPublicAppUrl()}/?reset_token=${resetToken}`;

    console.log(`\n======================================================`);
    console.log(`[EMAIL DISPATCH] Password Retrieval for ${merchant.business_name} (${merchant.email})`);
    console.log(`To reset your password, visit the link below (valid for 1 hour):`);
    console.log(`${resetLink}`);
    console.log(`======================================================\n`);

    return res.status(200).json({
      ok: true,
      message: "A password reset link has been dispatched to your email address.",
      resetToken: process.env.NODE_ENV !== "production" ? resetToken : undefined
    });
  } catch (err) {
    console.error("[auth.forgotPassword] Unexpected error:", err);
    return res.status(500).json({
      error: "unexpected_error",
      message: "Unable to complete password reset request."
    });
  }
}

export async function resetPassword(
  req: Request<object, object, { token?: string; newPassword?: string }>,
  res: Response
) {
  const token = req.body.token?.trim();
  const newPassword = req.body.newPassword;

  if (!token || !newPassword) {
    return res.status(400).json({
      error: "missing_fields",
      message: "Both reset token and new password are required."
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      error: "weak_password",
      message: "Password must be at least 8 characters long."
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      merchantId?: string;
      email?: string;
      purpose?: string;
    };

    if (decoded.purpose !== "password_reset" || !decoded.merchantId) {
      return res.status(400).json({
        error: "invalid_token",
        message: "Invalid or expired password reset token."
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from("merchants")
      .update({ password_hash: passwordHash })
      .eq("id", decoded.merchantId);

    if (updateError) {
      console.error("[auth.resetPassword] Failed to update password in database:", updateError);
      return res.status(500).json({
        error: "update_failed",
        message: "Unable to update password at this time."
      });
    }

    console.log(`[auth.resetPassword] Password successfully reset for merchant ${decoded.merchantId}.`);
    return res.status(200).json({
      ok: true,
      message: "Your password has been successfully updated. You can now log in with your new credentials."
    });
  } catch (err) {
    console.error("[auth.resetPassword] Token verification failed:", err);
    return res.status(400).json({
      error: "token_expired_or_invalid",
      message: "Password reset link is invalid or has expired. Please request a new one."
    });
  }
}

