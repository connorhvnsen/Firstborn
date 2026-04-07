import "server-only";
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  // Pin the API version so Stripe never changes the wire format under us.
  apiVersion: "2025-09-30.clover",
  typescript: true,
});

export const PRICE_USD_CENTS = 1499; // $14.99
export const CREDITS_PER_PURCHASE = 100;
export const PRICE_LABEL = "$14.99";
