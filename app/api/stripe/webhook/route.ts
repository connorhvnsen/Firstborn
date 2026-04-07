import "server-only";
import type Stripe from "stripe";
import { stripe, CREDITS_PER_PURCHASE } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return new Response("Missing signature or webhook secret.", { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(`Invalid signature: ${message}`, { status: 400 });
  }

  // Idempotency: if we've already processed this event id, return 200.
  const admin = createServiceClient();
  const { error: insertError } = await admin
    .from("stripe_events")
    .insert({ id: event.id });

  if (insertError) {
    // 23505 = unique_violation. Already processed — acknowledge.
    if (insertError.code === "23505") {
      return new Response("ok (duplicate)", { status: 200 });
    }
    return new Response(`Idempotency check failed: ${insertError.message}`, { status: 500 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid") {
      return new Response("ok (unpaid)", { status: 200 });
    }

    const userId =
      session.client_reference_id ?? session.metadata?.supabase_user_id ?? null;
    const credits = Number(session.metadata?.credits ?? CREDITS_PER_PURCHASE);

    if (!userId) {
      return new Response("Missing user id on session.", { status: 400 });
    }

    const { error } = await admin.rpc("add_credits", {
      p_user_id: userId,
      p_amount: credits,
    });

    if (error) {
      return new Response(`Failed to grant credits: ${error.message}`, { status: 500 });
    }
  }

  return new Response("ok", { status: 200 });
}
