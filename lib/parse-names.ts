export type NameSection = {
  name: string;
  story: string;
};

// Splits the model's markdown output (a flat list of `## Name` headings each
// followed by a story paragraph) into discrete sections. Tolerant of:
// - Stray emphasis around the name (`## **Holloway**`)
// - Trailing whitespace and blank lines between sections
// - Stories that span multiple paragraphs
//
// During streaming the final section may be incomplete (just a heading with
// no body yet, or a partial story). We still emit it — callers can decide
// whether to render partial sections.
export function parseNameSections(markdown: string): NameSection[] {
  if (!markdown) return [];

  const sections: NameSection[] = [];
  // Split on level-2 headings at line start. The leading delimiter is dropped,
  // so we keep an even/odd structure: [pre, name1, body1, name2, body2, ...].
  const parts = markdown.split(/^##\s+/m);
  // Index 0 is anything before the first heading — usually empty, sometimes
  // a stray preamble despite our prompt. Discard it.
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    const newlineIdx = block.indexOf("\n");
    const rawName = newlineIdx === -1 ? block : block.slice(0, newlineIdx);
    const story = newlineIdx === -1 ? "" : block.slice(newlineIdx + 1).trim();
    const name = rawName.replace(/[*_`]/g, "").trim();
    if (!name) continue;
    sections.push({ name, story });
  }
  return sections;
}

// Lowercase, trimmed key used for uniqueness checks (matches the DB
// `name_key` column convention).
export function nameKey(name: string): string {
  return name.trim().toLowerCase();
}
