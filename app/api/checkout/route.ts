import "server-only";
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { stripe, PRICE_USD_CENTS, CREDITS_PER_PURCHASE, PRICE_LABEL } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Look up (or lazily create) a Stripe customer for this user so repeat
  // top-ups stay attached to one customer record.
  const admin = createServiceClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("user_id", user.id);
  }

  const origin = new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    client_reference_id: user.id,
    metadata: {
      supabase_user_id: user.id,
      credits: String(CREDITS_PER_PURCHASE),
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: PRICE_USD_CENTS,
          product_data: {
            name: `${CREDITS_PER_PURCHASE} generations`,
            description: `One-time top-up — ${PRICE_LABEL}. Credits never expire.`,
          },
        },
      },
    ],
    success_url: `${origin}/?purchase=success`,
    cancel_url: `${origin}/?purchase=cancelled`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a URL." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
