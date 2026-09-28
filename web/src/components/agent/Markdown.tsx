"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components = {
  a: (props: React.ComponentProps<"a">) => <a {...props} target="_blank" rel="noreferrer" />,
  table: (props: React.ComponentProps<"table">) => (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table {...props} />
    </div>
  ),
};

/** Markdown de lecture ; `streaming` affiche un curseur clignotant en fin de texte. */
export const Markdown = memo(function Markdown({ text, streaming, className = "" }: { text: string; streaming?: boolean; className?: string }) {
  return (
    <div className={`prose-agent ${streaming ? "stream-caret" : ""} ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
