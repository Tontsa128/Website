import type { BlockType, PageBlock, RichTextDocument } from "./schema";

export function createRichTextDocument(text = ""): RichTextDocument {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        ...(text
          ? { content: [{ type: "text" as const, text }] }
          : {}),
      },
    ],
  };
}

export function createDefaultBlock(type: BlockType): PageBlock {
  const id = crypto.randomUUID();

  switch (type) {
    case "hero":
      return {
        id,
        type,
        version: 1,
        props: {
          title: "Tervetuloa yritykseesi",
          subtitle: "Kerro lyhyesti, miten voit auttaa asiakkaitasi.",
          buttonLabel: "Ota yhteyttä",
          buttonHref: "/yhteystiedot",
        },
      };
    case "text":
      return {
        id,
        type,
        version: 1,
        props: {
          content: createRichTextDocument(
            "Kirjoita tähän yrityksestäsi, palveluistasi tai siitä, mikä tekee toiminnastasi ainutlaatuista.",
          ),
        },
      };
    case "image":
      return {
        id,
        type,
        version: 1,
        props: {
          mediaId: null,
          altText: "",
          caption: "",
        },
      };
    case "button":
      return {
        id,
        type,
        version: 1,
        props: {
          label: "Lue lisää",
          href: "/",
        },
      };
    case "columns":
      return {
        id,
        type,
        version: 1,
        props: {
          layout: 2,
          cells: [
            createRichTextDocument("Ensimmäinen sisältöpalsta"),
            createRichTextDocument("Toinen sisältöpalsta"),
          ],
        },
      };
    case "gallery":
      return {
        id,
        type,
        version: 1,
        props: { mediaIds: [], columns: 3 },
      };
  }
}

export function createDefaultPageContent(): PageBlock[] {
  return [createDefaultBlock("hero"), createDefaultBlock("text")];
}
