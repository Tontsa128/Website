"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

import {
  isSafeLinkTarget,
  type RichTextDocument,
} from "@/blocks/schema";

type RichTextEditorProps = {
  value: RichTextDocument;
  label: string;
  onChange: (content: RichTextDocument) => void;
  compact?: boolean;
};

const toolbarClass =
  "min-h-9 min-w-9 rounded-lg border border-slate-200 px-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-40";

export function RichTextEditor({
  value,
  label,
  onChange,
  compact = false,
}: RichTextEditorProps) {
  const [linkMessage, setLinkMessage] = useState("");
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3, 4] },
          link: {
            openOnClick: false,
            HTMLAttributes: {
              target: "_blank",
              rel: "noopener noreferrer nofollow",
            },
          },
        }),
      ],
      content: value,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          "aria-label": label,
          class:
            "ProseMirror min-h-16 outline-none " +
            (compact ? "text-sm leading-6" : "text-base leading-7"),
        },
      },
      onUpdate: ({ editor: activeEditor }) => {
        setLinkMessage("");
        onChange(activeEditor.getJSON() as unknown as RichTextDocument);
      },
    },
    [label, compact],
  );

  useEffect(() => {
    if (!editor) return;
    const currentJson = JSON.stringify(editor.getJSON() as JSONContent);
    const nextJson = JSON.stringify(value);
    if (currentJson !== nextJson) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  function setLink() {
    if (!editor) return;
    const currentHref = editor.getAttributes("link").href;
    const entered = window.prompt(
      "Anna linkki (esim. https://example.fi, /yhteystiedot, mailto:osoite@example.fi tai tel:+358...)",
      typeof currentHref === "string" ? currentHref : "https://",
    );

    if (entered === null) return;
    const href = entered.trim();
    if (href === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkMessage("");
      return;
    }
    if (!isSafeLinkTarget(href)) {
      setLinkMessage("Linkissä sallitaan vain sivuston sisäiset, HTTPS/HTTP-, sähköposti- ja puhelinlinkit.");
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkMessage("");
  }

  if (!editor) {
    return (
      <div className="min-h-24 animate-pulse rounded-lg bg-slate-100" aria-label="Ladataan tekstieditoria" />
    );
  }

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 p-2">
        <button
          type="button"
          className={toolbarClass}
          aria-label="Lihavointi"
          aria-pressed={editor.isActive("bold")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={toolbarClass}
          aria-label="Kursivointi"
          aria-pressed={editor.isActive("italic")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={toolbarClass}
          aria-label="Alleviivaus"
          aria-pressed={editor.isActive("underline")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </button>
        <button
          type="button"
          className={toolbarClass}
          aria-label="Otsikko 2"
          aria-pressed={editor.isActive("heading", { level: 2 })}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
        <button
          type="button"
          className={toolbarClass}
          aria-label="Otsikko 3"
          aria-pressed={editor.isActive("heading", { level: 3 })}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </button>
        <button
          type="button"
          className={toolbarClass}
          aria-label="Luettelomerkit"
          aria-pressed={editor.isActive("bulletList")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • Lista
        </button>
        <button
          type="button"
          className={toolbarClass}
          aria-label="Numeroitu lista"
          aria-pressed={editor.isActive("orderedList")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. Lista
        </button>
        <button
          type="button"
          className={toolbarClass}
          aria-label="Lisää tai muokkaa linkki"
          aria-pressed={editor.isActive("link")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={setLink}
        >
          Linkki
        </button>
        <button
          type="button"
          className={toolbarClass}
          aria-label="Kumoa tekstimuutos"
          disabled={!editor.can().chain().focus().undo().run()}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          ↶
        </button>
        <button
          type="button"
          className={toolbarClass}
          aria-label="Tee tekstimuutos uudelleen"
          disabled={!editor.can().chain().focus().redo().run()}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          ↷
        </button>
      </div>
      {linkMessage && (
        <p role="status" className="px-3 pt-2 text-xs text-red-700">
          {linkMessage}
        </p>
      )}
      <div className={compact ? "px-3 py-2" : "px-4 py-3"}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
