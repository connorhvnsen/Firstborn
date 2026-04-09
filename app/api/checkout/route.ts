import "server-only";
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { stripe, CREDITS_PER_PURCHASE } from "@/lib/stripe";

const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (!STRIPE_PRICE_ID) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_ID is not configured." },
      { status: 500 },
    );
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
        price: STRIPE_PRICE_ID,
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
