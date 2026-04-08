"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { randomProjectName } from "@/lib/project-names";

export async function createProject() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("projects")
    .insert({ user_id: user.id, name: randomProjectName() })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create project: ${error?.message ?? "unknown"}`);
  }

  redirect(`/?project=${data.id}`);
}
