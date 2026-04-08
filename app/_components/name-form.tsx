"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  signedIn: boolean;
  initialCredits: number;
};

const fieldClass =
  "rounded-md border border-stone-200 bg-white px-4 py-3 text-stone-800 placeholder:text-stone-400 shadow-sm focus-visible:border-stone-400 focus-visible:ring-1 focus-visible:ring-stone-300";

const primaryButtonClass =
  "h-auto w-full rounded-md bg-stone-800 px-4 py-3 text-sm font-medium tracking-wide text-stone-50 shadow-none transition-colors hover:bg-stone-900 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:opacity-100";

export function NameForm({ signedIn, initialCredits }: Props) {
  const [description, setDescription] = useState("");
  const [feeling, setFeeling] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setCredits] = useState(initialCredits);
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
        <Field label="What are you building?" required htmlFor="description">
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

        <Field label="What should your audience feel?" htmlFor="feeling">
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
          <Link
            href="/login"
            className={`block text-center ${buttonVariants({ className: primaryButtonClass })}`}
          >
            Sign in to begin — 3 free generations
          </Link>
        ) : outOfCredits ? (
          <Button
            type="button"
            onClick={handleBuy}
            disabled={checkoutLoading}
            className={primaryButtonClass}
          >
            {checkoutLoading
              ? "Opening checkout..."
              : "Buy 100 generations — $14.99"}
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={!canSubmit}
            className={primaryButtonClass}
          >
            {loading ? "Listening to the stones..." : "Suggest Names"}
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

      {output && (
        <Card className="mt-12 gap-0 rounded-md border border-stone-200 bg-white py-0 shadow-sm ring-0">
          <CardContent className="prose prose-stone max-w-none p-6 prose-headings:font-light prose-headings:tracking-wide prose-p:leading-relaxed prose-strong:text-stone-900">
            <ReactMarkdown>{output}</ReactMarkdown>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Field({
  label,
  required,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label
        htmlFor={htmlFor}
        className="mb-2 block text-xs font-medium uppercase tracking-widest text-stone-500"
      >
        {label}
        {required && <span className="ml-1 text-stone-400">*</span>}
      </Label>
      {children}
    </div>
  );
}
