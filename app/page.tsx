import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NameForm } from "./_components/name-form";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string }>;
}) {
  const { purchase } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let credits = 0;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("credits")
      .eq("user_id", user.id)
      .single();
    credits = profile?.credits ?? 0;
  }

  return (
    <div className="min-h-full flex-1 bg-stone-50 text-stone-800">
      <Header signedIn={!!user} email={user?.email ?? null} credits={credits} />

      <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
        <header className="mb-12 text-center">
          <h1 className="text-3xl font-light tracking-wide text-stone-900 sm:text-4xl">
            庭 · Firstborn
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-stone-500">
            Hidden at the peak. Found through intention.
          </p>
        </header>

        {purchase === "success" && (
          <div className="mb-8 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Thank you. 100 generations have been added to your account.
          </div>
        )}
        {purchase === "cancelled" && (
          <div className="mb-8 rounded-md border border-stone-200 bg-stone-100 px-4 py-3 text-sm text-stone-600">
            Checkout cancelled. No charge was made.
          </div>
        )}

        <NameForm signedIn={!!user} initialCredits={credits} />

        <footer className="mt-16 text-center text-xs text-stone-400">
          一期一会 — one meeting, one chance.
        </footer>
      </main>
    </div>
  );
}

function Header({
  signedIn,
  email,
  credits,
}: {
  signedIn: boolean;
  email: string | null;
  credits: number;
}) {
  return (
    <div className="border-b border-stone-200 bg-white/60 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-3 text-xs">
        <span className="text-stone-400">庭</span>
        {signedIn ? (
          <div className="flex items-center gap-4">
            <span className="text-stone-500">
              <span className="font-medium text-stone-800">{credits}</span>{" "}
              {credits === 1 ? "generation" : "generations"} left
            </span>
            <span className="hidden text-stone-300 sm:inline">·</span>
            <span className="hidden text-stone-500 sm:inline">{email}</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
