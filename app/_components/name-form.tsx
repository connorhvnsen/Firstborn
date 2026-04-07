"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

type Props = {
  signedIn: boolean;
  initialCredits: number;
};

export function NameForm({ signedIn, initialCredits }: Props) {
  const [description, setDescription] = useState("");
  const [feeling, setFeeling] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState(initialCredits);
  const [outOfCredits, setOutOfCredits] = useState(initialCredits === 0);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || loading) return;

    setLoading(true);
    setError(null);
    setOutput("");

    try {
      const res = await fetch("/api/generate-names", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, feeling, competitors }),
      });

      if (res.status === 402) {
        setOutOfCredits(true);
        setCredits(0);
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Out of generations.");
      }

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      // Optimistically update the visible balance.
      setCredits((c) => Math.max(0, c - 1));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setOutput((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

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

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Field label="What are you building?" required>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A tea shop that only sells single-origin matcha..."
            rows={4}
            maxLength={2000}
            className="w-full resize-none rounded-md border border-stone-200 bg-white px-4 py-3 text-stone-800 placeholder-stone-400 shadow-sm focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300"
            required
          />
        </Field>

        <Field label="What should your audience feel?">
          <input
            value={feeling}
            onChange={(e) => setFeeling(e.target.value)}
            placeholder="Calm, curious, in on a secret..."
            className="w-full rounded-md border border-stone-200 bg-white px-4 py-3 text-stone-800 placeholder-stone-400 shadow-sm focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300"
          />
        </Field>

        <Field label="Competitors (and what they're called)">
          <textarea
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            placeholder="Ippodo, Marukyu Koyamaen, Nami Matcha..."
            rows={2}
            className="w-full resize-none rounded-md border border-stone-200 bg-white px-4 py-3 text-stone-800 placeholder-stone-400 shadow-sm focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300"
          />
        </Field>

        {!signedIn ? (
          <a
            href="/login"
            className="block w-full rounded-md bg-stone-800 px-4 py-3 text-center text-sm font-medium tracking-wide text-stone-50 transition-colors hover:bg-stone-900"
          >
            Sign in to begin — 3 free generations
          </a>
        ) : outOfCredits ? (
          <button
            type="button"
            onClick={handleBuy}
            disabled={checkoutLoading}
            className="w-full rounded-md bg-stone-800 px-4 py-3 text-sm font-medium tracking-wide text-stone-50 transition-colors hover:bg-stone-900 disabled:bg-stone-400"
          >
            {checkoutLoading
              ? "Opening checkout..."
              : "Buy 100 generations — $14.99"}
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-md bg-stone-800 px-4 py-3 text-sm font-medium tracking-wide text-stone-50 transition-colors hover:bg-stone-900 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {loading ? "Listening to the stones..." : "Suggest Names"}
          </button>
        )}
      </form>

      {error && (
        <div className="mt-8 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {output && (
        <article className="prose prose-stone mt-12 max-w-none rounded-md border border-stone-200 bg-white p-6 shadow-sm prose-headings:font-light prose-headings:tracking-wide prose-p:leading-relaxed prose-strong:text-stone-900">
          <ReactMarkdown>{output}</ReactMarkdown>
        </article>
      )}
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-widest text-stone-500">
        {label}
        {required && <span className="ml-1 text-stone-400">*</span>}
      </span>
      {children}
    </label>
  );
}
