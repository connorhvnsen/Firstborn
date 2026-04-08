"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import ReactMarkdown from "react-markdown";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { Element, ElementContent, Root, RootContent } from "hast";

// Per-word stagger constants. Tweak these to change the entrance feel.
const WORD_DELAY = 0.01; // seconds between consecutive words
const WORD_DURATION = 0.6; // seconds for each word's animation
const Y_DISTANCE = 8; // pixels each word travels upward
const BLUR_PX = 8; // initial blur amount

// Singleton processor — parsing the markdown to mdast and lowering to hast
// is pure, so we can reuse one pipeline across renders/instances.
const processor = unified().use(remarkParse).use(remarkRehype);

const wordStyle: CSSProperties = {
  display: "inline-block",
  willChange: "transform, opacity, filter",
};

type Counter = { i: number };

type Props = {
  children: string;
};

/**
 * Renders markdown with a staggered per-word entrance: each word fades in,
 * slides upward a few pixels, and unblurs. Markdown structure (headings,
 * paragraphs, bold, etc.) is preserved — only leaf text gets wrapped in
 * animated spans. Honors prefers-reduced-motion by falling back to plain
 * markdown rendering.
 *
 * Word indices are computed in a single pre-pass over the parsed hast tree
 * inside `useMemo`, so each word's delay is fixed before React renders.
 * Don't move the counter back into render — Strict Mode's double-invoke
 * and react-markdown's component overrides made the per-block stagger drift,
 * which produced visible pauses between blocks.
 *
 * To retrigger the animation, give the parent element a unique `key` so
 * this component remounts on output change (the form already does this
 * via the generation id).
 */
export function AnimatedMarkdown({ children }: Props) {
  const reduced = useReducedMotion();

  const tree = useMemo(() => {
    if (reduced) return null;
    const mdast = processor.parse(children);
    const hast = processor.runSync(mdast) as Root;
    const counter: Counter = { i: 0 };
    return hast.children.map((child, i) =>
      renderRootChild(child, counter, `n${i}`),
    );
  }, [children, reduced]);

  if (reduced) {
    return <ReactMarkdown>{children}</ReactMarkdown>;
  }

  return <>{tree}</>;
}

function renderRootChild(
  node: RootContent,
  counter: Counter,
  key: string,
): ReactNode {
  if (node.type === "element" || node.type === "text") {
    return renderNode(node, counter, key);
  }
  // doctype, comment, etc. — markdown→hast won't normally produce these.
  return null;
}

function renderNode(
  node: ElementContent,
  counter: Counter,
  key: string,
): ReactNode {
  if (node.type === "text") {
    // Split into words and runs of whitespace, preserving spaces so
    // line-wrapping behaves like normal text.
    const parts = node.value.split(/(\s+)/);
    return parts.map((part, i) => {
      const partKey = `${key}.t${i}`;
      if (part === "" || /^\s+$/.test(part)) {
        return <span key={partKey}>{part}</span>;
      }
      const idx = counter.i++;
      return (
        <motion.span
          key={partKey}
          initial={{
            opacity: 0,
            y: Y_DISTANCE,
            filter: `blur(${BLUR_PX}px)`,
          }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            delay: idx * WORD_DELAY,
            duration: WORD_DURATION,
            ease: [0.22, 1, 0.36, 1], // smooth ease-out
          }}
          style={wordStyle}
        >
          {part}
        </motion.span>
      );
    });
  }
  if (node.type === "element") {
    return renderElement(node, counter, key);
  }
  return null;
}

// HTML void elements — React will throw if you pass `children` to any of
// these, even an empty array. Markdown can produce `<br>` (hard line break)
// and `<hr>` (thematic break) directly; the rest are here for safety in
// case future plugins emit them.
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function renderElement(el: Element, counter: Counter, key: string): ReactNode {
  const Tag = el.tagName as keyof React.JSX.IntrinsicElements;
  const props = hastPropsToReact(el.properties);
  if (VOID_ELEMENTS.has(el.tagName)) {
    return <Tag key={key} {...props} />;
  }
  const children = el.children.map((child, i) =>
    renderNode(child, counter, `${key}.${i}`),
  );
  return (
    <Tag key={key} {...props}>
      {children}
    </Tag>
  );
}

// hast already uses React-style property names (className, htmlFor, etc.).
// We just need to flatten className arrays and drop nullish/false values.
function hastPropsToReact(
  properties: Element["properties"],
): Record<string, unknown> {
  if (!properties) return {};
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(properties)) {
    if (v == null || v === false) continue;
    if (k === "className" && Array.isArray(v)) {
      props.className = v.join(" ");
      continue;
    }
    props[k] = v;
  }
  return props;
}
