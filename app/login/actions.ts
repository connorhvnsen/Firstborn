"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type Provider = "google" | "apple";

export async function signInWith(provider: Provider) {
  const supabase = await createClient();
  const h = await headers();
  // On Vercel, x-forwarded-host/proto are always set and reflect the public
  // hostname the user is on. The `origin` header is unreliable for server
  // actions, and `host` doesn't include the protocol.
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signInWithGoogle() {
  await signInWith("google");
}

export async function signInWithApple() {
  await signInWith("apple");
}
