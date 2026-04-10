"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProject } from "@/app/_actions/projects";
import { toggleFavorite } from "@/app/_actions/favorites";
import { CREDITS_PER_PURCHASE, PRICE_LABEL } from "@/lib/pricing";
import { nameKey, parseNameSections } from "@/lib/parse-names";
import { NameCard } from "./name-card";
import { countWords } from "./animated-markdown";
import { FavoritesSection, type Favorite } from "./favorites-section";
import { SignInDialog } from "./sign-in-dialog";

type Project = { id: string; name: string };

type Generation = {
  id: string;
  description: string;
  feeling: string | null;
  competitors: string | null;
  output: string;
  created_at: string;
};

type Props = {
  signedIn: boolean;
  initialCredits: number;
  unlimited: boolean;
  projects: Project[];
  currentProjectId: string | null;
  initialGenerations: Generation[];
  initialFavorites: Favorite[];
};

const fieldClass =
  "rounded-md border border-stone-200 bg-white px-4 py-3 text-stone-800 placeholder:text-stone-400 shadow-sm focus-visible:border-stone-400 focus-visible:ring-1 focus-visible:ring-stone-300";

const primaryButtonClass =
  "h-auto w-full rounded-md bg-stone-800 px-4 py-3 text-sm font-medium tracking-wide text-stone-50 shadow-none transition-colors hover:bg-stone-900 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:opacity-100";

export function NameForm({
  signedIn,
  initialCredits,
  unlimited,
  projects,
  currentProjectId,
  initialGenerations,
  initialFavorites,
}: Props) {
  const router = useRouter();
  const [signInOpen, setSignInOpen] = useState(false);
  const [creatingProject, startCreatingProject] = useTransition();

  // Local mirror of the project's favorites. We update this optimistically
  // when the user toggles a star so the UI feels instant; the server action
  // resolves in the background and rolls back on failure.
  const [favorites, setFavorites] = useState<Favorite[]>(initialFavorites);
  const favoriteKeys = useMemo(
    () => new Set(favorites.map((f) => f.name_key)),
    [favorites],
  );
  // Track which name_keys currently have an in-flight toggle so we can
  // disable the button and avoid double-firing the action.
  const [pendingFavoriteKeys, setPendingFavoriteKeys] = useState<Set<string>>(
    () => new Set(),
  );

  // Reset favorites when the parent passes a new project's set. The page
  // currently re-mounts NameForm via `key={currentProjectId}`, so this
  // effect is mostly defensive — it keeps things sane if that ever changes.
  useEffect(() => {
    setFavorites(initialFavorites);
  }, [initialFavorites]);

  // Persist the active project so navigating away and back remembers it.
  useEffect(() => {
    if (currentProjectId) {
      document.cookie = `last_project=${currentProjectId};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    }
  }, [currentProjectId]);

  async function handleToggleFavorite(args: {
    name: string;
    story: string;
    generationId: string | null;
  }) {
    if (!currentProjectId) return;
    const key = nameKey(args.name);
    if (!key || pendingFavoriteKeys.has(key)) return;

    const wasFavorited = favoriteKeys.has(key);
    const previousFavorites = favorites;

    // Optimistic update — flip the state immediately so the star fills/empties
    // before the server round-trip resolves.
    setPendingFavoriteKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    if (wasFavorited) {
      setFavorites((prev) => prev.filter((f) => f.name_key !== key));
    } else {
      const optimistic: Favorite = {
        // Temporary client-side id; the next router.refresh() will replace
        // it with the real DB row when we re-fetch from the server.
        id: `local-${Date.now()}`,
        name: args.name,
        name_key: key,
        story: args.story,
        created_at: new Date().toISOString(),
      };
      setFavorites((prev) => [optimistic, ...prev]);
    }

    try {
      const result = await toggleFavorite({
        projectId: currentProjectId,
        name: args.name,
        story: args.story,
        generationId: args.generationId,
      });
      if (!result.ok) {
        // Roll back on failure.
        setFavorites(previousFavorites);
        setError(result.error);
      } else {
        // Pull the canonical row(s) from the server so any local-id placeholders
        // are replaced and timestamps are accurate.
        router.refresh();
      }
    } catch (err) {
      setFavorites(previousFavorites);
      setError(err instanceof Error ? err.message : "Could not save favorite.");
    } finally {
      setPendingFavoriteKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  function handleUnfavoriteFromList(fav: Favorite) {
    void handleToggleFavorite({
      name: fav.name,
      story: fav.story,
      generationId: null,
    });
  }

  // Local copy of the project's generations. Newest first. We mutate this
  // locally after each successful submission so the user doesn't have to
  // wait for a server round-trip to see their new gen in the pagination.
  const [genList, setGenList] = useState<Generation[]>(initialGenerations);
  // Index into genList for the currently displayed generation. 0 = newest.
  const [currentIndex, setCurrentIndex] = useState(0);

  const initial = initialGenerations[0];
  const [description, setDescription] = useState(initial?.description ?? "");
  const [feeling, setFeeling] = useState(initial?.feeling ?? "");
  const [competitors, setCompetitors] = useState(initial?.competitors ?? "");
  const [output, setOutput] = useState(initial?.output ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outOfCredits, setOutOfCredits] = useState(
    !unlimited && initialCredits === 0,
  );
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Parse the currently visible generation's markdown into discrete name
  // sections so each can be rendered as a card with its own star button.
  const sections = useMemo(() => parseNameSections(output), [output]);
  const currentGenerationId = genList[currentIndex]?.id ?? null;

  // Scroll the output card to near the top of the viewport whenever a
  // generation kicks off, so the user immediately sees the skeleton /
  // result instead of having to scroll past the form.
  const outputCardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loading) return;
    outputCardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [loading]);

  function showGen(index: number) {
    const g = genList[index];
    if (!g) return;
    setCurrentIndex(index);
    setDescription(g.description);
    setFeeling(g.feeling ?? "");
    setCompetitors(g.competitors ?? "");
    setOutput(g.output);
    setError(null);
    outputCardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await runGeneration();
  }

  async function runGeneration() {
    if (!description.trim() || loading || !currentProjectId) return;

    setLoading(true);
    setError(null);
    // Intentionally do NOT clear `output` here — the previous generation
    // stays on screen while the skeleton loader indicates new content is
    // being produced.

    // Snapshot the inputs at submit time so the new gen we prepend later
    // matches what was actually sent to the API, even if the user edits
    // the fields while it's streaming.
    const submittedDescription = description;
    const submittedFeeling = feeling;
    const submittedCompetitors = competitors;

    try {
      const res = await fetch("/api/generate-names", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: submittedDescription,
          feeling: submittedFeeling,
          competitors: submittedCompetitors,
          projectId: currentProjectId,
        }),
      });

      if (res.status === 402) {
        setOutOfCredits(true);
        router.refresh();
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Out of generations.");
      }

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      // Accumulate the entire response before rendering anything. The user
      // explicitly prefers a single fade-in over a token-by-token stream —
      // it feels more intentional and gives a clean reveal moment.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullOutput = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        fullOutput += decoder.decode(value, { stream: true });
      }

      // Prepend the new generation to the local list and jump to it.
      // The id/created_at are placeholders — they only matter for keys
      // and the server will have authoritative values on the next reload.
      const newGen: Generation = {
        id: `local-${Date.now()}`,
        description: submittedDescription,
        feeling: submittedFeeling || null,
        competitors: submittedCompetitors || null,
        output: fullOutput,
        created_at: new Date().toISOString(),
      };
      setGenList((prev) => [newGen, ...prev]);
      setCurrentIndex(0);
      setOutput(fullOutput);
      // Refresh the server component so the header credit count updates.
      // Runs after the result is already on screen, so it's invisible to UX.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // After OAuth sign-in, check if the user had a pending generation and
  // auto-fire it so they don't have to click again.
  const runGenerationRef = useRef(runGeneration);
  useLayoutEffect(() => {
    runGenerationRef.current = runGeneration;
  });
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (!signedIn || !currentProjectId || hasRestoredRef.current) return;
    const raw = sessionStorage.getItem("pending_generation");
    if (!raw) return;
    hasRestoredRef.current = true;
    sessionStorage.removeItem("pending_generation");
    try {
      const saved = JSON.parse(raw) as {
        description?: string;
        feeling?: string;
        competitors?: string;
      };
      if (saved.description?.trim()) {
        setDescription(saved.description);
        setFeeling(saved.feeling ?? "");
        setCompetitors(saved.competitors ?? "");
        setTimeout(() => runGenerationRef.current(), 0);
      }
    } catch {
      // Corrupt data — ignore.
    }
  }, [signedIn, currentProjectId]);

  async function handleBuy() {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Could not start checkout.");
        setCheckoutLoading(false);
      }
    } catch {
      setError("Could not start checkout.");
      setCheckoutLoading(false);
    }
  }

  const canSubmit =
    signedIn && !outOfCredits && !loading && description.trim().length > 0;

  function handleProjectChange(id: string | null) {
    if (!id || id === currentProjectId) return;
    document.cookie = `last_project=${id};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    router.push(`/?project=${id}`);
  }

  function handleNewProject() {
    startCreatingProject(async () => {
      await createProject();
    });
  }

  return (
    <>
      {signedIn && currentProjectId && projects.length > 0 && (
        <div className="mb-8">
          <Label
            htmlFor="project-select"
            className="mb-2 block text-xs font-medium tracking-widest text-stone-500 uppercase"
          >
            Project
          </Label>
          <div className="flex items-center gap-2">
            <Select
              value={currentProjectId}
              onValueChange={handleProjectChange}
              items={projects.map((p) => ({ value: p.id, label: p.name }))}
            >
              <SelectTrigger
                id="project-select"
                size="default"
                className="w-full flex-1 rounded-md border-stone-200 bg-white text-stone-800 shadow-sm focus-visible:ring-1 focus-visible:ring-stone-300"
              >
                <SelectValue>
                  {(value: string | null) =>
                    projects.find((p) => p.id === value)?.name ?? ""
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="border border-stone-200 bg-white shadow-sm">
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleNewProject}
              disabled={creatingProject}
              className="rounded-md border-stone-200 bg-white text-stone-700 shadow-sm hover:bg-stone-50 hover:text-stone-900"
            >
              {creatingProject ? "…" : "+ New Project"}
            </Button>
          </div>
        </div>
      )}

      {signedIn && currentProjectId && (
        <FavoritesSection
          favorites={favorites}
          onUnfavorite={handleUnfavoriteFromList}
          pendingKeys={pendingFavoriteKeys}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Field
          label="What are you building?"
          required
          htmlFor="description"
          helper="A few sentences. The richer the picture (what makes it unique, who it's for, the story behind it) the better."
        >
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A tea shop that only sells single-origin matcha..."
            rows={4}
            maxLength={2000}
            required
            className={`min-h-0 resize-none ${fieldClass}`}
          />
        </Field>

        <Field
          label="What should your audience feel?"
          htmlFor="feeling"
          helper="Optional. Adjectives, moods, references — the impression you want a stranger to take away in three seconds."
        >
          <Input
            id="feeling"
            value={feeling}
            onChange={(e) => setFeeling(e.target.value)}
            placeholder="Calm, curious, in on a secret..."
            className={`h-auto ${fieldClass}`}
          />
        </Field>

        <Field
          label="Competitors (and what they're called)"
          htmlFor="competitors"
          helper="Optional. The names matter more than the companies — we'll steer your suggestions away from anything that sounds like them."
        >
          <Textarea
            id="competitors"
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            placeholder="Ippodo, Marukyu Koyamaen, Nami Matcha..."
            rows={2}
            className={`min-h-0 resize-none ${fieldClass}`}
          />
        </Field>

        {!signedIn ? (
          <Button
            type="button"
            onClick={() => {
              sessionStorage.setItem(
                "pending_generation",
                JSON.stringify({ description, feeling, competitors }),
              );
              setSignInOpen(true);
            }}
            disabled={!description.trim()}
            className={primaryButtonClass}
          >
            Generate Names
          </Button>
        ) : outOfCredits ? (
          <Button
            type="button"
            onClick={handleBuy}
            disabled={checkoutLoading}
            className={primaryButtonClass}
          >
            {checkoutLoading
              ? "Opening checkout..."
              : `Buy ${CREDITS_PER_PURCHASE} generations — ${PRICE_LABEL}`}
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={!canSubmit}
            className={primaryButtonClass}
          >
            {loading
              ? "Listening to the flame..."
              : output
                ? "Regenerate"
                : "Suggest Names"}
          </Button>
        )}
      </form>

      {error && (
        <Alert
          variant="destructive"
          className="mt-8 border-red-200 bg-red-50 px-4 py-3 text-red-700 ring-0"
        >
          <AlertDescription className="text-sm text-red-700">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {(output || loading) && (
        <Card
          ref={outputCardRef}
          className="relative mt-20 scroll-mt-20 gap-0 overflow-clip rounded-md border border-stone-200 bg-white py-0 shadow-sm ring-0"
        >
          <CardContent className="p-0">
            {/* Relative wrapper anchors the absolute skeleton overlay so
                it can sit on top of the previous generation's content
                without changing the card's height. */}
            <div className="relative">
              {output && (
                <div key={currentGenerationId ?? "empty"}>
                  {
                    sections.reduce<{
                      nodes: React.ReactNode[];
                      offset: number;
                    }>(
                      (acc, section) => {
                        const key = nameKey(section.name);
                        acc.nodes.push(
                          <NameCard
                            key={`${currentGenerationId ?? "empty"}-${key}`}
                            name={section.name}
                            story={section.story}
                            favorited={favoriteKeys.has(key)}
                            pending={pendingFavoriteKeys.has(key)}
                            onToggle={() =>
                              handleToggleFavorite({
                                name: section.name,
                                story: section.story,
                                generationId: currentGenerationId,
                              })
                            }
                            wordOffset={acc.offset}
                          />,
                        );
                        // +1 for the heading word, then the story words
                        acc.offset += 1 + countWords(section.story);
                        return acc;
                      },
                      { nodes: [], offset: 0 },
                    ).nodes
                  }
                  {!loading && (
                    <div className="border-t border-stone-100 px-6 py-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="default"
                        onClick={runGeneration}
                        disabled={!canSubmit}
                        className="w-full rounded-md border-stone-200 bg-white text-stone-700 shadow-sm hover:bg-stone-50 hover:text-stone-900"
                      >
                        <RefreshCw className="size-4 shrink-0" />
                        Generate
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {loading && (
                <div
                  className={
                    output
                      ? "absolute inset-0 rounded-t-md bg-white"
                      : "min-h-80"
                  }
                >
                  <OutputSkeleton />
                </div>
              )}
            </div>
          </CardContent>
          {genList.length > 0 && (
            <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-b-md border-t border-stone-200 bg-white/80 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => showGen(genList.length - 1)}
                  disabled={loading || currentIndex >= genList.length - 1}
                  className="size-9 rounded-md border-stone-200 bg-white text-stone-700 shadow-sm hover:bg-stone-50 hover:text-stone-900"
                  aria-label="First page"
                >
                  <ChevronFirst className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => showGen(currentIndex + 1)}
                  disabled={loading || currentIndex >= genList.length - 1}
                  className="size-9 rounded-md border-stone-200 bg-white text-stone-700 shadow-sm hover:bg-stone-50 hover:text-stone-900 sm:size-auto sm:px-3 sm:py-2"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4 shrink-0 sm:hidden" />
                  <span className="hidden sm:inline">← Prev</span>
                </Button>
              </div>
              <span className="flex items-center gap-2 text-xs text-stone-500">
                {loading ? (
                  <>
                    <RefreshCw className="size-3 shrink-0 animate-spin" />
                    Generating…
                  </>
                ) : (
                  `${genList.length - currentIndex} of ${genList.length}`
                )}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => showGen(currentIndex - 1)}
                  disabled={loading || currentIndex <= 0}
                  className="size-9 rounded-md border-stone-200 bg-white text-stone-700 shadow-sm hover:bg-stone-50 hover:text-stone-900 sm:size-auto sm:px-3 sm:py-2"
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4 shrink-0 sm:hidden" />
                  <span className="hidden sm:inline">Next →</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => showGen(0)}
                  disabled={loading || currentIndex <= 0}
                  className="size-9 rounded-md border-stone-200 bg-white text-stone-700 shadow-sm hover:bg-stone-50 hover:text-stone-900"
                  aria-label="Last page"
                >
                  <ChevronLast className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
    </>
  );
}

// Tailwind p-6 = 24px each side, h-20 = 80px, gap-6 = 24px. Keep in sync
// with the className below if you tweak any of those.
const SKELETON_PADDING_Y = 48;
const SKELETON_ROW_HEIGHT = 80;
const SKELETON_ROW_GAP = 24;

function OutputSkeleton() {
  // Measure the container's height and render however many skeleton rows
  // fit inside it. ResizeObserver keeps the count in sync if the window
  // (and therefore the prose underneath) resizes mid-load.
  const containerRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(1);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function measure() {
      if (!el) return;
      const usable = Math.max(0, el.clientHeight - SKELETON_PADDING_Y);
      // The last row doesn't need a trailing gap, so add one gap before
      // dividing.
      const fit = Math.floor(
        (usable + SKELETON_ROW_GAP) / (SKELETON_ROW_HEIGHT + SKELETON_ROW_GAP),
      );
      setCount(Math.max(1, fit));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col gap-6 p-6"
      aria-busy="true"
      aria-live="polite"
      aria-label="Generating new names"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full shrink-0" />
      ))}
    </div>
  );
}

function Field({
  label,
  required,
  htmlFor,
  helper,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label
        htmlFor={htmlFor}
        className="mb-2 block text-xs font-medium tracking-widest text-stone-500 uppercase"
      >
        {label}
        {required && <span className="ml-1 text-stone-400">*</span>}
      </Label>
      {helper && (
        <p className="mb-2 text-xs leading-relaxed text-stone-500">{helper}</p>
      )}
      {children}
    </div>
  );
}
