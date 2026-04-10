import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { Header } from "../../_components/header";
import { Footer } from "../../_components/footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { PromptToggle } from "./prompt-toggle";
import { FavoritesPanel } from "./favorites-panel";

type Generation = {
  id: string;
  description: string;
  feeling: string | null;
  competitors: string | null;
  output: string;
  created_at: string;
};

export default async function ProjectHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: project }, { data: generations }, { data: favorites }] =
    await Promise.all([
      supabase.from("profiles").select("credits").eq("user_id", user.id).single(),
      supabase
        .from("projects")
        .select("id, name")
        .eq("id", id)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("generations")
        .select("id, description, feeling, competitors, output, created_at")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("favorites")
        .select("id, name, name_key, story, created_at")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (!project) {
    notFound();
  }

  const credits = profile?.credits ?? 0;
  const items: Generation[] = generations ?? [];

  return (
    <div className="min-h-full flex-1 bg-stone-50 text-stone-800">
      <Header signedIn email={user.email ?? null} credits={credits} />

      <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
        <header className="mb-12 text-center">
          <Link
            href="/history"
            className="text-xs text-stone-400 underline-offset-4 hover:text-stone-700 hover:underline"
          >
            ← All projects
          </Link>
          <h1 className="mt-4 text-3xl font-light tracking-wide text-stone-900 sm:text-4xl">
            {project.name}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-stone-500">
            {items.length === 0
              ? "No generations yet."
              : `${items.length} ${items.length === 1 ? "generation" : "generations"}.`}
          </p>
          <Link
            href={`/?project=${project.id}`}
            className="mt-6 inline-block text-sm text-stone-700 underline-offset-4 hover:underline"
          >
            Open in generator →
          </Link>
        </header>

        <FavoritesPanel projectId={id} initialFavorites={favorites ?? []} />

        {items.length === 0 ? (
          <Card className="gap-0 rounded-md border border-stone-200 bg-white py-0 text-center shadow-sm ring-0">
            <CardContent className="px-6 py-12 text-sm text-stone-500">
              <p>You haven't generated any names in this project yet.</p>
              <Link
                href={`/?project=${project.id}`}
                className="mt-4 inline-block text-stone-700 underline-offset-2 hover:underline"
              >
                Begin →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Accordion multiple className="space-y-3">
            {items.map((g) => (
              <AccordionItem
                key={g.id}
                value={g.id}
                className="overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm not-last:border-b transition-colors data-panel-open:border-stone-300"
              >
                <AccordionTrigger className="min-w-0 rounded-none px-5 py-4 hover:bg-stone-50 hover:no-underline focus-visible:ring-0">
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm text-stone-800">
                      {extractNames(g.output).join(", ") ||
                        truncate(g.description, 80)}
                    </p>
                    <p className="mt-1 text-xs text-stone-400">
                      {formatDate(g.created_at)}
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="border-t border-stone-100 px-5 py-5">
                  <article className="prose prose-stone max-w-none prose-headings:font-light prose-headings:tracking-wide prose-p:leading-relaxed prose-strong:text-stone-900">
                    <ReactMarkdown>{g.output}</ReactMarkdown>
                  </article>
                  <div className="mt-6 border-t border-stone-100 pt-4">
                    <PromptToggle
                      description={g.description}
                      feeling={g.feeling}
                      competitors={g.competitors}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        <Footer />
      </main>
    </div>
  );
}

function truncate(s: string, n: number) {
  const trimmed = s.trim().replace(/\s+/g, " ");
  return trimmed.length > n ? trimmed.slice(0, n - 1) + "…" : trimmed;
}

// Pull brand names out of the streamed markdown. The model isn't perfectly
// consistent about which heading level it uses for categories vs. names, so
// we look at every heading level present and pick the DEEPEST one with at
// least two matches — categories are always at a shallower level than the
// names beneath them. Falls back to bullet/bold patterns if no name-headings
// exist at all.
function extractNames(output: string): string[] {
  const lines = output.split("\n");

  const headingsByLevel = new Map<number, string[]>();
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!m) continue;
    const level = m[1].length;
    const text = stripFormatting(m[2]);
    if (!text) continue;
    if (!headingsByLevel.has(level)) headingsByLevel.set(level, []);
    headingsByLevel.get(level)!.push(text);
  }

  if (headingsByLevel.size >= 2) {
    const deepest = Math.max(...headingsByLevel.keys());
    const names = headingsByLevel.get(deepest)!;
    if (names.length >= 2) return dedupe(names);
  }

  const listed = lines
    .map((l) => l.match(/^\s*(?:[-*]|\d+\.)\s+\*\*(.+?)\*\*/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => stripFormatting(m[1]));
  if (listed.length >= 2) return dedupe(listed);

  const boldStart = lines
    .map((l) => l.match(/^\*\*(.+?)\*\*/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => stripFormatting(m[1]));
  if (boldStart.length >= 2) return dedupe(boldStart);

  if (headingsByLevel.size === 1) {
    const only = headingsByLevel.values().next().value!;
    if (only.length >= 2) return dedupe(only);
  }

  return [];
}

function stripFormatting(s: string) {
  return s
    .replace(/[*_`]/g, "")
    .replace(/^\d+\.\s*/, "")
    .trim();
}

function dedupe(arr: string[]) {
  return Array.from(new Set(arr));
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
