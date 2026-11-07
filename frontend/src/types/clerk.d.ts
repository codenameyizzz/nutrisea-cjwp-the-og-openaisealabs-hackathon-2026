import type { ClerkRole } from "../services/session-access";

export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata?: { role?: ClerkRole; merchant_ids?: string[] };
  }
}
