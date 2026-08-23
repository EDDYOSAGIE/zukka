import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";

type AuthenticatedParams = {
  merchantId: string;
} & Record<string, string>;

type MerchantJwtPayload = JwtPayload & {
  merchantId?: string;
};

function getJwtSecret(): Secret {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required for token authentication.");
  }

  return jwtSecret;
}

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function extractSessionToken(req: Request<AuthenticatedParams>): string | null {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((entry) => entry.trim());
  const sessionCookie = cookies.find((entry) => entry.startsWith("zuka_session="));

  if (!sessionCookie) {
    return null;
  }

  return decodeURIComponent(sessionCookie.slice("zuka_session=".length));
}

export function authenticateToken(
  req: Request<AuthenticatedParams>,
  res: Response,
  next: NextFunction
) {
  console.log("[auth.middleware] Authenticating inbound request.");

  const token = extractBearerToken(req.headers.authorization) ?? extractSessionToken(req);

  if (!token) {
    console.warn("[auth.middleware] Request rejected because Bearer token is missing.");
    return res.status(401).json({
      error: "missing_authorization_token",
      message: "A Bearer token is required to access this resource."
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as MerchantJwtPayload;

    if (!decoded.merchantId) {
      console.warn("[auth.middleware] Request rejected because JWT merchantId is missing.");
      return res.status(403).json({
        error: "invalid_token_payload",
        message: "Token payload is missing the merchant tenant context."
      });
    }

    const merchantId = decoded.merchantId as string;
    req.params.merchantId = merchantId;
    console.log(`[auth.middleware] Merchant ${merchantId} authenticated for request.`);

    return next();
  } catch (error) {
    console.warn("[auth.middleware] Request rejected because JWT verification failed.", error);
    return res.status(403).json({
      error: "invalid_or_expired_token",
      message: "The supplied token is invalid or expired."
    });
  }
}
