import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "../_components/header";
import { Card, CardContent } from "@/components/ui/card";

type Project = {
  id: string;
  name: string;
  created_at: string;
};

type GenerationStub = {
  project_id: string;
  created_at: string;
};

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: projectRows }, { data: generationRows }] =
    await Promise.all([
      supabase.from("profiles").select("credits").eq("user_id", user.id).single(),
      supabase
        .from("projects")
        .select("id, name, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("generations")
        .select("project_id, created_at")
        .order("created_at", { ascending: false }),
    ]);

  const credits = profile?.credits ?? 0;
  const projects: Project[] = projectRows ?? [];
  const generations: GenerationStub[] = generationRows ?? [];

  // Roll up counts and the most recent generation timestamp per project.
  const stats = new Map<string, { count: number; lastAt: string | null }>();
  for (const p of projects) {
    stats.set(p.id, { count: 0, lastAt: null });
  }
  for (const g of generations) {
    const s = stats.get(g.project_id);
    if (!s) continue;
    s.count += 1;
    if (!s.lastAt || g.created_at > s.lastAt) {
      s.lastAt = g.created_at;
    }
  }

  // Sort projects: most recent activity first, projects with no generations
  // sink to the bottom (sorted by creation date among themselves).
  const sorted = [...projects].sort((a, b) => {
    const sa = stats.get(a.id)!;
    const sb = stats.get(b.id)!;
    if (sa.lastAt && sb.lastAt) return sb.lastAt.localeCompare(sa.lastAt);
    if (sa.lastAt) return -1;
    if (sb.lastAt) return 1;
    return b.created_at.localeCompare(a.created_at);
  });

  return (
    <div className="min-h-full flex-1 bg-stone-50 text-stone-800">
      <Header signedIn email={user.email ?? null} credits={credits} />

      <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
        <header className="mb-12 text-center">
          <h1 className="text-3xl font-light tracking-wide text-stone-900 sm:text-4xl">
            Projects
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-stone-500">
            Every name you've ever called forth.
          </p>
        </header>

        {sorted.length === 0 ? (
          <Card className="gap-0 rounded-md border border-stone-200 bg-white py-0 text-center shadow-sm ring-0">
            <CardContent className="px-6 py-12 text-sm text-stone-500">
              <p>No projects yet.</p>
              <Link
                href="/"
                className="mt-4 inline-block text-stone-700 underline-offset-2 hover:underline"
              >
                Begin →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {sorted.map((p) => {
              const s = stats.get(p.id)!;
              return (
                <li key={p.id}>
                  <Link
                    href={`/history/${p.id}`}
                    className="block overflow-hidden rounded-md border border-stone-200 bg-white px-5 py-4 shadow-sm transition-colors hover:border-stone-300 hover:bg-stone-50"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="truncate text-base font-light tracking-wide text-stone-800">
                        {p.name}
                      </p>
                      <p className="shrink-0 text-xs text-stone-400">
                        {s.count === 0
                          ? "Empty"
                          : `${s.count} ${s.count === 1 ? "generation" : "generations"}`}
                      </p>
                    </div>
                    {s.lastAt && (
                      <p className="mt-1 text-xs text-stone-400">
                        Last: {formatDate(s.lastAt)}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="mt-16 text-center text-xs text-stone-400">
          一期一会 — one meeting, one chance.
        </footer>
      </main>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
