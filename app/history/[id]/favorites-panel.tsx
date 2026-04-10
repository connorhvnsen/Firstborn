"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFavorite } from "@/app/_actions/favorites";
import {
  FavoritesSection,
  type Favorite,
} from "@/app/_components/favorites-section";

type Props = {
  projectId: string;
  initialFavorites: Favorite[];
};

// Client wrapper that manages optimistic unfavorite state and delegates
// rendering to the shared FavoritesSection component.
export function FavoritesPanel({ projectId, initialFavorites }: Props) {
  const router = useRouter();
  const [favorites, setFavorites] = useState(initialFavorites);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  async function handleUnfavorite(fav: Favorite) {
    setPendingKeys((prev) => new Set(prev).add(fav.name_key));
    // Optimistically remove
    setFavorites((prev) => prev.filter((f) => f.id !== fav.id));

    const result = await toggleFavorite({
      projectId,
      name: fav.name,
      story: fav.story,
    });

    setPendingKeys((prev) => {
      const next = new Set(prev);
      next.delete(fav.name_key);
      return next;
    });

    if (!result.ok) {
      // Revert on failure
      setFavorites((prev) => [...prev, fav]);
    }

    startTransition(() => router.refresh());
  }

  return (
    <FavoritesSection
      favorites={favorites}
      onUnfavorite={handleUnfavorite}
      pendingKeys={pendingKeys}
    />
  );
}
