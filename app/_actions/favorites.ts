"use server";

import { createClient } from "@/lib/supabase/server";
import { nameKey } from "@/lib/parse-names";

export type ToggleFavoriteResult =
  | { ok: true; favorited: boolean }
  | { ok: false; error: string };

// Toggles a (project, name) favorite for the current user. Idempotent:
// calling it twice in a row returns to the original state. Returns
// `favorited: true` if the row now exists, `false` if it was just deleted.
//
// We rely on RLS for authorization — the SELECT/INSERT/DELETE policies on
// `public.favorites` constrain everything to `auth.uid() = user_id`.
export async function toggleFavorite(input: {
  projectId: string;
  name: string;
  story: string;
  generationId?: string | null;
}): Promise<ToggleFavoriteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const key = nameKey(input.name);
  if (!key) {
    return { ok: false, error: "Empty name." };
  }

  // Look for an existing favorite for this (project, name).
  const { data: existing, error: selectError } = await supabase
    .from("favorites")
    .select("id")
    .eq("project_id", input.projectId)
    .eq("name_key", key)
    .maybeSingle();

  if (selectError) {
    return { ok: false, error: selectError.message };
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existing.id);
    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }
    return { ok: true, favorited: false };
  }

  // generation_id is optional — if the source generation isn't a real DB
  // row yet (e.g. an in-flight `local-...` placeholder id from the client),
  // store null and the favorite stands on its own.
  const generationId =
    input.generationId && !input.generationId.startsWith("local-")
      ? input.generationId
      : null;

  const { error: insertError } = await supabase.from("favorites").insert({
    user_id: user.id,
    project_id: input.projectId,
    name: input.name,
    name_key: key,
    story: input.story,
    generation_id: generationId,
  });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }
  return { ok: true, favorited: true };
}
