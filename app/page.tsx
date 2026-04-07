import { createClient } from "@/lib/supabase/server";
import { Header } from "./_components/header";
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
            初 · Firstborn
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
