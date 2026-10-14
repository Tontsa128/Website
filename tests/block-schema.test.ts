import { describe, expect, it } from "vitest";

import { createDefaultBlock, createDefaultPageContent, createRichTextDocument } from "../src/blocks/defaults";
import { PageContentSchema, isRichTextDocument, isSafeLinkTarget } from "../src/blocks/schema";

describe("page block schemas", () => {
  it("accepts all default block types", () => {
    const blocks = [
      createDefaultBlock("hero"),
      createDefaultBlock("text"),
      createDefaultBlock("image"),
      createDefaultBlock("button"),
      createDefaultBlock("columns"),
    ];

    expect(PageContentSchema.safeParse(blocks).success).toBe(true);
  });

  it("accepts the default page starter content", () => {
    expect(PageContentSchema.safeParse(createDefaultPageContent()).success).toBe(true);
  });

  it("rejects unsupported block types and schema versions", () => {
    const block = createDefaultBlock("hero");
    expect(PageContentSchema.safeParse([{ ...block, type: "script" }]).success).toBe(false);
    expect(PageContentSchema.safeParse([{ ...block, version: 2 }]).success).toBe(false);
  });

  it("rejects unsafe button URLs", () => {
    const block = createDefaultBlock("button");
    const unsafe = { ...block, props: { ...block.props, href: "javascript:alert(1)" } };
    expect(PageContentSchema.safeParse([unsafe]).success).toBe(false);
  });

  it("rejects unsafe links nested in Tiptap JSON", () => {
    const block = createDefaultBlock("text");
    const unsafe = {
      ...block,
      props: {
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "do not execute",
                  marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
                },
              ],
            },
          ],
        },
      },
    };
    expect(PageContentSchema.safeParse([unsafe]).success).toBe(false);
  });

  it("allows empty paragraphs returned by Tiptap after a user deletes text", () => {
    const doc = createRichTextDocument("");
    expect(isRichTextDocument(doc)).toBe(true);
    expect(PageContentSchema.safeParse([{ ...createDefaultBlock("text"), props: { content: doc } }]).success).toBe(true);
  });

  it("limits pages to 100 blocks", () => {
    const blocks = Array.from({ length: 101 }, () => createDefaultBlock("text"));
    expect(PageContentSchema.safeParse(blocks).success).toBe(false);
  });

  it("only allows safe target protocols", () => {
    expect(isSafeLinkTarget("https://example.fi/palvelut")).toBe(true);
    expect(isSafeLinkTarget("/yhteystiedot")).toBe(true);
    expect(isSafeLinkTarget("mailto:test@example.fi")).toBe(true);
    expect(isSafeLinkTarget("tel:+358401234567")).toBe(true);
    expect(isSafeLinkTarget("//example.fi")).toBe(false);
    expect(isSafeLinkTarget("javascript:alert(1)")).toBe(false);
    expect(isSafeLinkTarget("data:text/html,hello")).toBe(false);
  });
});
