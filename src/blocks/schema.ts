import { z } from "zod";

export type RichTextMark = {
  type: "bold" | "italic" | "strike" | "code" | "underline" | "link";
  attrs?: Record<string, unknown>;
};

export type RichTextNode = {
  type:
    | "doc"
    | "paragraph"
    | "heading"
    | "text"
    | "hardBreak"
    | "bulletList"
    | "orderedList"
    | "listItem"
    | "blockquote"
    | "horizontalRule"
    | "codeBlock";
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: RichTextMark[];
  content?: RichTextNode[];
};

export type RichTextDocument = RichTextNode & {
  type: "doc";
  content: RichTextNode[];
};

const allowedNodes = new Set<string>([
  "doc",
  "paragraph",
  "heading",
  "text",
  "hardBreak",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "horizontalRule",
  "codeBlock",
]);
const allowedMarks = new Set<string>([
  "bold",
  "italic",
  "strike",
  "code",
  "underline",
  "link",
]);

export function isSafeLinkTarget(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const candidate = value.trim();
  if (
    candidate.length === 0 ||
    candidate.length > 2000 ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return false;
  }

  if (candidate.startsWith("/") && !candidate.startsWith("//")) return true;
  if (candidate.startsWith("#")) return candidate.length > 1;

  try {
    const parsed = new URL(candidate);
    return ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRichNode(
  value: unknown,
  depth: number,
  counter: { count: number },
): value is RichTextNode {
  counter.count += 1;
  if (counter.count > 1000 || depth > 12 || !isRecord(value)) return false;
  if (typeof value.type !== "string" || !allowedNodes.has(value.type)) return false;

  if (value.type === "text") {
    if (typeof value.text !== "string" || value.text.length > 20000) return false;
  } else if (value.text !== undefined) {
    return false;
  }

  if (value.attrs !== undefined && !isRecord(value.attrs)) return false;

  if (value.type === "heading") {
    const level = value.attrs?.level;
    if (level !== 2 && level !== 3 && level !== 4) return false;
  }

  if (value.type === "orderedList" && value.attrs?.start !== undefined) {
    const start = value.attrs.start;
    if (typeof start !== "number" || !Number.isInteger(start) || start < 1) return false;
  }

  if (value.marks !== undefined) {
    if (!Array.isArray(value.marks) || value.marks.length > 20) return false;
    for (const mark of value.marks) {
      if (!isRecord(mark) || typeof mark.type !== "string" || !allowedMarks.has(mark.type)) {
        return false;
      }
      if (mark.attrs !== undefined && !isRecord(mark.attrs)) return false;
      if (mark.type === "link" && !isSafeLinkTarget(mark.attrs?.href)) return false;
    }
  }

  if (value.content !== undefined) {
    if (!Array.isArray(value.content) || value.content.length > 1000) return false;
    for (const child of value.content) {
      if (!validateRichNode(child, depth + 1, counter)) return false;
    }
  }

  if (
    value.type !== "doc" &&
    value.type !== "text" &&
    value.type !== "hardBreak" &&
    value.type !== "horizontalRule" &&
    value.content === undefined &&
    value.type !== "paragraph" &&
    value.type !== "heading"
  ) {
    return false;
  }

  return true;
}

export function isRichTextDocument(value: unknown): value is RichTextDocument {
  if (!isRecord(value) || value.type !== "doc" || !Array.isArray(value.content)) {
    return false;
  }
  const counter = { count: 0 };
  return validateRichNode(value, 0, counter);
}

export const RichTextDocumentSchema = z.custom<RichTextDocument>(
  isRichTextDocument,
  "Rich text JSON is invalid or contains an unsafe link",
);

const safeHrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(isSafeLinkTarget, "Link target is not allowed");

const blockBase = {
  id: z.string().uuid(),
  version: z.literal(1),
};

export const HeroBlockSchema = z.object({
  ...blockBase,
  type: z.literal("hero"),
  props: z.object({
    title: z.string().trim().min(1).max(120),
    subtitle: z.string().max(800),
    buttonLabel: z.string().max(80),
    buttonHref: safeHrefSchema,
  }).strict(),
}).strict();

export const TextBlockSchema = z.object({
  ...blockBase,
  type: z.literal("text"),
  props: z.object({
    content: RichTextDocumentSchema,
  }).strict(),
}).strict();

export const ImageBlockSchema = z.object({
  ...blockBase,
  type: z.literal("image"),
  props: z.object({
    mediaId: z.string().uuid().nullable(),
    altText: z.string().max(500),
    caption: z.string().max(500),
  }).strict(),
}).strict();

export const ButtonBlockSchema = z.object({
  ...blockBase,
  type: z.literal("button"),
  props: z.object({
    label: z.string().trim().min(1).max(80),
    href: safeHrefSchema,
  }).strict(),
}).strict();

export const ColumnsBlockSchema = z.object({
  ...blockBase,
  type: z.literal("columns"),
  props: z.object({
    layout: z.union([z.literal(2), z.literal(3)]),
    cells: z.array(RichTextDocumentSchema).min(2).max(3),
  }).strict().refine((props) => props.cells.length === props.layout, {
    message: "The number of column cells must match the layout",
  }),
}).strict();

export const GalleryBlockSchema = z.object({
  ...blockBase,
  type: z.literal("gallery"),
  props: z.object({
    mediaIds: z.array(z.string().uuid()).max(30).refine(
      (ids) => new Set(ids).size === ids.length,
      "Gallery media ids must be unique",
    ),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  }).strict(),
}).strict();

export const PageBlockSchema = z.discriminatedUnion("type", [
  HeroBlockSchema,
  TextBlockSchema,
  ImageBlockSchema,
  ButtonBlockSchema,
  ColumnsBlockSchema,
  GalleryBlockSchema,
]);

export const PageContentSchema = z.array(PageBlockSchema).max(100, {
  error: "A page can contain at most 100 blocks",
});

export type HeroBlock = z.infer<typeof HeroBlockSchema>;
export type TextBlock = z.infer<typeof TextBlockSchema>;
export type ImageBlock = z.infer<typeof ImageBlockSchema>;
export type ButtonBlock = z.infer<typeof ButtonBlockSchema>;
export type ColumnsBlock = z.infer<typeof ColumnsBlockSchema>;
export type GalleryBlock = z.infer<typeof GalleryBlockSchema>;
export type PageBlock = z.infer<typeof PageBlockSchema>;
export type BlockType = PageBlock["type"];
