"use client";

import { Star } from "lucide-react";
import { motion } from "motion/react";
import { AnimatedMarkdown } from "./animated-markdown";

type Props = {
  name: string;
  story: string;
  favorited: boolean;
  pending: boolean;
  onToggle: () => void;
  wordOffset?: number;
};

// Renders one generated name + its story as a card with a favorite toggle.
// The story is run through AnimatedMarkdown so the per-word entrance still
// fires when a freshly generated card mounts. The heading itself is rendered
// statically — we don't want the star button overlaying animated text.
export function NameCard({
  name,
  story,
  favorited,
  pending,
  onToggle,
  wordOffset = 0,
}: Props) {
  return (
    <article className="border-b border-stone-100 px-6 py-5 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <motion.h2
          className="text-xl font-light tracking-wide text-stone-900"
          initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: wordOffset * 0.01, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {name}
        </motion.h2>
        <button
          type="button"
          onClick={onToggle}
          disabled={pending}
          aria-pressed={favorited}
          aria-label={favorited ? `Remove ${name} from favorites` : `Favorite ${name}`}
          className="-m-1 flex shrink-0 items-center justify-center rounded-full p-1 text-stone-400 transition-colors hover:text-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Star
            className={`size-5 transition-colors ${
              favorited ? "fill-amber-400 text-amber-500" : "fill-none"
            }`}
            strokeWidth={1.5}
          />
        </button>
      </div>
      {story && (
        <div className="prose prose-stone prose-p:leading-relaxed prose-p:text-stone-600 prose-p:my-3 prose-strong:text-stone-900 mt-1 max-w-none text-sm">
          <AnimatedMarkdown wordOffset={wordOffset}>{story}</AnimatedMarkdown>
        </div>
      )}
    </article>
  );
}
