import { createHmac, timingSafeEqual } from "node:crypto";
import env from "../env";

type SessionTokenPayload = {
  sub: string;
};

const algorithm = "HS256";
const tokenType = "JWT";

const base64UrlEncode = (value: string | Buffer) => {
  return Buffer.from(value).toString("base64url");
};

const base64UrlDecode = (value: string) => {
  return Buffer.from(value, "base64url").toString("utf8");
};

const sign = (value: string) => {
  return createHmac("sha256", env.JWT_SECRET).update(value).digest("base64url");
};

export const generateSessionToken = (userId: string) => {
  const header = base64UrlEncode(
    JSON.stringify({
      alg: algorithm,
      typ: tokenType,
    }),
  );
  const payload = base64UrlEncode(JSON.stringify({ sub: userId }));
  const signature = sign(`${header}.${payload}`);

  return `${header}.${payload}.${signature}`;
};

export const verifySessionToken = (token: string): SessionTokenPayload => {
  const [encodedHeader, encodedPayload, signature, ...extraParts] =
    token.split(".");

  if (
    !encodedHeader ||
    !encodedPayload ||
    !signature ||
    extraParts.length > 0
  ) {
    throw new Error("Invalid session token");
  }

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);
  const signatureBuffer = Buffer.from(signature, "base64url");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "base64url");

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    throw new Error("Invalid session token");
  }

  const header = JSON.parse(base64UrlDecode(encodedHeader)) as {
    alg?: unknown;
    typ?: unknown;
  };

  if (header.alg !== algorithm || header.typ !== tokenType) {
    throw new Error("Invalid session token");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as {
    sub?: unknown;
  };

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Invalid session token");
  }

  return { sub: payload.sub };
};
