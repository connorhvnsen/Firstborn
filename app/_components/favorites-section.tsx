"use client";

import { useState } from "react";
import { ChevronDown, Star } from "lucide-react";
import ReactMarkdown from "react-markdown";

export type Favorite = {
  id: string;
  name: string;
  name_key: string;
  story: string;
  created_at: string;
};

type Props = {
  favorites: Favorite[];
  onUnfavorite: (favorite: Favorite) => void;
  pendingKeys: Set<string>;
};

// Collapsible list of every favorited name in the current project. Sits
// above the form so users can scan their picks without leaving the page.
// Hidden entirely when there are no favorites — keeps the empty state clean.
export function FavoritesSection({
  favorites,
  onUnfavorite,
  pendingKeys,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  if (favorites.length === 0) return null;

  return (
    <div className="mb-8 rounded-md border border-stone-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-md px-4 py-3 text-left transition-colors hover:bg-stone-50"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2 text-xs font-medium tracking-widest text-stone-500 uppercase">
          <Star
            className="size-4 fill-amber-400 text-amber-500"
            strokeWidth={1.5}
          />
          {favorites.length} favorite{favorites.length === 1 ? "" : "s"}
        </span>
        <ChevronDown
          className={`size-4 text-stone-400 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      {expanded && (
        <ul className="border-t border-stone-100">
          {favorites.map((fav) => {
            const pending = pendingKeys.has(fav.name_key);
            return (
              <li
                key={fav.id}
                className="border-b border-stone-100 px-4 py-4 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-base font-light tracking-wide text-stone-900">
                    {fav.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => onUnfavorite(fav)}
                    disabled={pending}
                    aria-label={`Remove ${fav.name} from favorites`}
                    className="-m-1 flex shrink-0 items-center justify-center rounded-full p-1 text-amber-500 transition-colors hover:text-stone-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Star
                      className="size-4 fill-amber-400"
                      strokeWidth={1.5}
                    />
                  </button>
                </div>
                {fav.story && (
                  <div className="prose prose-stone prose-p:leading-relaxed prose-p:text-stone-600 prose-p:my-2 prose-strong:text-stone-900 mt-1 max-w-none text-sm">
                    <ReactMarkdown>{fav.story}</ReactMarkdown>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
