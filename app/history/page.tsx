import Link from "next/link";
import { redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { Header } from "../_components/header";

type Generation = {
  id: string;
  description: string;
  feeling: string | null;
  competitors: string | null;
  output: string;
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

  const [{ data: profile }, { data: generations }] = await Promise.all([
    supabase.from("profiles").select("credits").eq("user_id", user.id).single(),
    supabase
      .from("generations")
      .select("id, description, feeling, competitors, output, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const credits = profile?.credits ?? 0;
  const items: Generation[] = generations ?? [];

  return (
    <div className="min-h-full flex-1 bg-stone-50 text-stone-800">
      <Header signedIn email={user.email ?? null} credits={credits} />

      <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
        <header className="mb-12 text-center">
          <h1 className="text-3xl font-light tracking-wide text-stone-900 sm:text-4xl">
            History
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-stone-500">
            Every name you've ever called forth.
          </p>
        </header>

        {items.length === 0 ? (
          <div className="rounded-md border border-stone-200 bg-white px-6 py-12 text-center text-sm text-stone-500 shadow-sm">
            <p>You haven't generated any names yet.</p>
            <Link
              href="/"
              className="mt-4 inline-block text-stone-700 underline-offset-2 hover:underline"
            >
              Begin →
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((g) => (
              <li key={g.id}>
                <details className="group overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm transition-colors open:border-stone-300">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 hover:bg-stone-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-stone-800">
                        {extractNames(g.output).join(", ") ||
                          truncate(g.description, 80)}
                      </p>
                      <p className="mt-1 text-xs text-stone-400">
                        {formatDate(g.created_at)}
                      </p>
                    </div>
                    <span className="mt-1 text-stone-300 transition-transform group-open:rotate-90">
                      ›
                    </span>
                  </summary>

                  <div className="border-t border-stone-100 px-5 py-5">
                    <Inputs g={g} />
                    <article className="prose prose-stone mt-6 max-w-none prose-headings:font-light prose-headings:tracking-wide prose-p:leading-relaxed prose-strong:text-stone-900">
                      <ReactMarkdown>{g.output}</ReactMarkdown>
                    </article>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}

        <footer className="mt-16 text-center text-xs text-stone-400">
          一期一会 — one meeting, one chance.
        </footer>
      </main>
    </div>
  );
}

function Inputs({ g }: { g: Generation }) {
  return (
    <dl className="space-y-3 text-sm">
      <Row label="Project">{g.description}</Row>
      {g.feeling && <Row label="Feeling">{g.feeling}</Row>}
      {g.competitors && <Row label="Competitors">{g.competitors}</Row>}
    </dl>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-widest text-stone-400">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-stone-700">{children}</dd>
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

  // Bucket headings by level.
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

  // If two or more heading levels are present, the deeper one holds names.
  // If only one level is present, it might be categories *or* names — fall
  // through to the bold-pattern checks first to disambiguate.
  if (headingsByLevel.size >= 2) {
    const deepest = Math.max(...headingsByLevel.keys());
    const names = headingsByLevel.get(deepest)!;
    if (names.length >= 2) return dedupe(names);
  }

  // No nested headings — try bullet/bold patterns.
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

  // Single heading level with no bold pattern — last resort, use it.
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
