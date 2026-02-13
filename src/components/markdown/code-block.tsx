"use client";

import { useState, useRef } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  node?: any;
  className?: string;
  children?: React.ReactNode;
  "data-language"?: string;
  "data-filename"?: string;
  "data-description"?: string;
}

export default function CodeBlock({
  node,
  className,
  children,
  "data-language": dataLanguage,
  "data-filename": dataFilename,
  "data-description": dataDescription,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  // Extract language from className (e.g., "language-js")
  const languageMatch = className?.match(/language-(\w+)/);
  const language = dataLanguage || (languageMatch ? languageMatch[1] : "text");

  // Determine what to show as the title/header
  const title = dataFilename || dataDescription || language;

  const handleCopy = async () => {
    if (codeRef.current) {
      const text = codeRef.current.textContent || "";
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      data-code-block
      className="code-block-shell relative my-4 w-full max-w-full box-border rounded-lg border border-[color:var(--border)] bg-[color:var(--panel-bg)] overflow-hidden group"
    >
      {/* Header bar */}
      <div className="code-block-header flex items-center justify-between px-4 py-1 border-b border-[color:var(--border)] bg-[color:var(--panel-bg)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden md:flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            {dataFilename && (
              <span className="text-xs font-medium text-[color:var(--app-text)] truncate">
                {dataFilename}
              </span>
            )}
            <span className="text-xs font-mono text-[color:var(--text-muted)] truncate">
              {language}
            </span>
            {dataDescription && (
              <span className="text-xs text-[color:var(--text-muted)] truncate">
                {dataDescription}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-md bg-[color:var(--panel-bg)] border border-[color:var(--border)] hover:bg-[color:var(--border)] transition-colors opacity-90 group-hover:opacity-100"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <>
              <Check size={12} />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <pre
        className="code-block-pre overflow-x-auto m-0 p-0 w-full max-w-full box-border"
        style={{ borderRadius: 0 }}
      >
        <code
          ref={codeRef}
          className={`code-block-code ${className ?? ""} block p-4 w-full max-w-full box-border`}
        >
          {children}
        </code>
      </pre>
    </div>
  );
}
