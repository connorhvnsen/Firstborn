import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Header } from "./_components/header";
import { NameForm } from "./_components/name-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isUnlimitedUser } from "@/lib/unlimited-users";
import { CREDITS_PER_PURCHASE } from "@/lib/pricing";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string; project?: string }>;
}) {
  const { purchase, project: requestedProjectId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let credits = 0;
  let projects: { id: string; name: string }[] = [];
  let currentProjectId: string | null = null;

  if (user) {
    const [{ data: profile }, { data: projectRows }] = await Promise.all([
      supabase.from("profiles").select("credits").eq("user_id", user.id).single(),
      supabase
        .from("projects")
        .select("id, name")
        .order("created_at", { ascending: false }),
    ]);
    credits = profile?.credits ?? 0;
    projects = projectRows ?? [];

    // Make sure the user always has at least one project. If they have none,
    // create one with a random DS3 name via the SECURITY DEFINER RPC and
    // re-load the list.
    if (projects.length === 0) {
      const admin = createServiceClient();
      await admin.rpc("get_or_create_default_project", {
        p_user_id: user.id,
        p_name: "First Flame",
      });
      const { data: refreshed } = await supabase
        .from("projects")
        .select("id, name")
        .order("created_at", { ascending: false });
      projects = refreshed ?? [];
    }

    // Resolve the active project: prefer the URL param if it's one of the
    // user's projects, otherwise fall back to the most recent.
    const requested = projects.find((p) => p.id === requestedProjectId);
    currentProjectId = requested?.id ?? projects[0]?.id ?? null;

    // If the URL had an invalid/foreign id, scrub it from the URL.
    if (requestedProjectId && requested === undefined && currentProjectId) {
      redirect(`/?project=${currentProjectId}`);
    }
  }

  // Load every generation for the active project (newest first). The form
  // displays one at a time and lets the user paginate through the project's
  // history with prev/next buttons in the sticky bar at the bottom of the
  // output card.
  let initialGenerations: {
    id: string;
    description: string;
    feeling: string | null;
    competitors: string | null;
    output: string;
    created_at: string;
  }[] = [];
  if (currentProjectId) {
    const { data: gens } = await supabase
      .from("generations")
      .select("id, description, feeling, competitors, output, created_at")
      .eq("project_id", currentProjectId)
      .order("created_at", { ascending: false });
    initialGenerations = gens ?? [];
  }

  return (
    <div className="min-h-full flex-1 bg-stone-50 text-stone-800">
      <Header
        signedIn={!!user}
        email={user?.email ?? null}
        credits={credits}
        unlimited={isUnlimitedUser(user?.email)}
      />

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
          <Alert className="mb-8 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 ring-0">
            <AlertDescription className="text-sm text-emerald-800">
              Thank you. {CREDITS_PER_PURCHASE} generations have been added to your account.
            </AlertDescription>
          </Alert>
        )}
        {purchase === "cancelled" && (
          <Alert className="mb-8 rounded-md border border-stone-200 bg-stone-100 px-4 py-3 text-stone-600 ring-0">
            <AlertDescription className="text-sm text-stone-600">
              Checkout cancelled. No charge was made.
            </AlertDescription>
          </Alert>
        )}

        <NameForm
          key={currentProjectId ?? "none"}
          signedIn={!!user}
          initialCredits={credits}
          unlimited={isUnlimitedUser(user?.email)}
          projects={projects}
          currentProjectId={currentProjectId}
          initialGenerations={initialGenerations}
        />

        <footer className="mt-16 text-center text-xs text-stone-400">
          一期一会 — one meeting, one chance.
        </footer>
      </main>
    </div>
  );
}
