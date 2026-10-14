import { Fragment, createElement, type ReactNode } from "react";

import { isSafeLinkTarget, type PageBlock, type RichTextDocument, type RichTextNode } from "./schema";

function renderRichNode(node: RichTextNode, key: string): ReactNode {
  if (node.type === "text") {
    let text: ReactNode = node.text ?? "";
    const marks = node.marks ?? [];

    for (let index = marks.length - 1; index >= 0; index -= 1) {
      const mark = marks[index];
      if (!mark) continue;

      if (mark.type === "bold") {
        text = createElement("strong", { key: key + "-bold-" + index }, text);
      } else if (mark.type === "italic") {
        text = createElement("em", { key: key + "-italic-" + index }, text);
      } else if (mark.type === "underline") {
        text = createElement("u", { key: key + "-underline-" + index }, text);
      } else if (mark.type === "strike") {
        text = createElement("s", { key: key + "-strike-" + index }, text);
      } else if (mark.type === "code") {
        text = createElement("code", { key: key + "-code-" + index }, text);
      } else if (mark.type === "link") {
        const href = mark.attrs?.href;
        if (isSafeLinkTarget(href)) {
          const isExternal = /^https?:\/\//i.test(href);
          text = createElement(
            "a",
            {
              key: key + "-link-" + index,
              href,
              ...(isExternal ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {}),
              className: "text-sky-800 underline underline-offset-4",
            },
            text,
          );
        }
      }
    }

    return createElement(Fragment, { key }, text);
  }

  const children = (node.content ?? []).map((child, index) =>
    renderRichNode(child, key + "-" + index),
  );

  switch (node.type) {
    case "doc":
      return createElement(Fragment, { key }, children);
    case "paragraph":
      return createElement("p", { key, className: "my-3 leading-7" }, children);
    case "heading": {
      const candidate = node.attrs?.level;
      const level = candidate === 2 || candidate === 3 || candidate === 4 ? candidate : 2;
      return createElement(
        "h" + level,
        { key, className: "my-4 font-semibold tracking-tight text-slate-950" },
        children,
      );
    }
    case "bulletList":
      return createElement("ul", { key, className: "my-3 list-disc space-y-1 pl-6" }, children);
    case "orderedList":
      return createElement("ol", { key, className: "my-3 list-decimal space-y-1 pl-6" }, children);
    case "listItem":
      return createElement("li", { key }, children);
    case "blockquote":
      return createElement(
        "blockquote",
        { key, className: "my-4 border-l-2 border-slate-300 pl-4 italic text-slate-600" },
        children,
      );
    case "codeBlock":
      return createElement(
        "pre",
        { key, className: "my-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-white" },
        createElement("code", null, children),
      );
    case "horizontalRule":
      return createElement("hr", { key, className: "my-6 border-slate-200" });
    case "hardBreak":
      return createElement("br", { key });
    default:
      return createElement(Fragment, { key }, children);
  }
}

export function RichTextView({
  content,
  className,
}: {
  content: RichTextDocument;
  className?: string;
}) {
  return (
    <div className={className}>
      {renderRichNode(content, "rich-text-root")}
    </div>
  );
}

export function BlockPreview({ block }: { block: PageBlock }) {
  switch (block.type) {
    case "hero":
      return (
        <section className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-6 py-10 text-white sm:px-10 sm:py-14">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
            Hero-osio
          </p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
            {block.props.title}
          </h1>
          <p className="mt-4 max-w-2xl whitespace-pre-wrap text-base leading-7 text-slate-200 sm:text-lg">
            {block.props.subtitle}
          </p>
          {block.props.buttonLabel && (
            <span className="mt-6 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950">
              {block.props.buttonLabel}
            </span>
          )}
        </section>
      );
    case "text":
      return <RichTextView content={block.props.content} className="px-2 py-2" />;
    case "image":
      return (
        <figure className="overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50">
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-5 py-10 text-center text-slate-500">
            <span aria-hidden="true" className="text-4xl">▧</span>
            <p className="font-medium text-slate-700">Kuvan paikkamerkki</p>
            <p className="max-w-sm text-sm">
              {block.props.altText || "Kuvan valinta avataan mediakirjaston valmistuessa vaiheessa 4."}
            </p>
          </div>
          {block.props.caption && (
            <figcaption className="border-t border-slate-200 bg-white px-4 py-3 text-center text-sm text-slate-600">
              {block.props.caption}
            </figcaption>
          )}
        </figure>
      );
    case "button":
      return (
        <div className="py-3 text-center">
          <span className="inline-flex rounded-xl bg-slate-950 px-5 py-3 font-medium text-white">
            {block.props.label}
          </span>
        </div>
      );
    case "columns":
      return (
        <div
          className={"grid gap-4 " + (block.props.layout === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}
        >
          {block.props.cells.map((cell, index) => (
            <div
              key={block.id + "-cell-" + index}
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-4"
            >
              <RichTextView content={cell} />
            </div>
          ))}
        </div>
      );
  }
}
