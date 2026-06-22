import { SignJWT, jwtVerify } from "jose";
import { config } from "./config";
import type { JwtPayload } from "../types";

const secret = new TextEncoder().encode(config.jwt.secret);

export async function signToken(
  payload: Omit<JwtPayload, "iat" | "exp">,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as JwtPayload;
}

export function generateRefreshToken(): string {
  return crypto.randomUUID() + "-" + crypto.randomUUID();
}

export function refreshTokenExpiresAt(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date;
}
