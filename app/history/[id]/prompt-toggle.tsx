"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  description: string;
  feeling: string | null;
  competitors: string | null;
};

export function PromptToggle({ description, feeling, competitors }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button
        type="button"
        variant="link"
        onClick={() => setOpen((o) => !o)}
        className="h-auto p-0 text-xs font-medium uppercase tracking-widest text-stone-500 underline-offset-4 hover:text-stone-800 hover:no-underline"
      >
        {open ? "Hide prompt" : "Show prompt"}
      </Button>

      {open && (
        <dl className="mt-4 space-y-3 text-sm">
          <Row label="Description">{description}</Row>
          {feeling && <Row label="Feeling">{feeling}</Row>}
          {competitors && <Row label="Competitors">{competitors}</Row>}
        </dl>
      )}
    </div>
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
