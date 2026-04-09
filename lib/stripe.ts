import "server-only";
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  // Pin the API version so Stripe never changes the wire format under us.
  apiVersion: "2025-09-30.clover",
  typescript: true,
});

export { PRICE_USD_CENTS, CREDITS_PER_PURCHASE, PRICE_LABEL } from "./pricing";
