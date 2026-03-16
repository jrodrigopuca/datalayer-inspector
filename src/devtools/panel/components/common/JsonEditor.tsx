/**
 * JsonEditor component - textarea with JSON syntax highlighting
 * 
 * Uses an overlay technique: a transparent textarea on top of a 
 * highlighted pre element. User types in the textarea, the pre
 * shows the syntax-highlighted version synced in real-time.
 */

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  id?: string;
  className?: string;
  placeholder?: string;
}

/**
 * Tokenize JSON string into highlighted spans
 */
function highlightJson(json: string): string {
  // Escape HTML entities first
  const escaped = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Token patterns (order matters - more specific first)
  const patterns: Array<{ regex: RegExp; className: string }> = [
    // Type placeholders (@string, @number?, @enum(a,b), etc.)
    { 
      regex: /"(@(?:string|number|boolean|array|object|any)\??)"/g, 
      className: "text-purple-400" 
    },
    // Enum placeholders with values
    { 
      regex: /"(@enum\([^"]*\))"/g, 
      className: "text-purple-400" 
    },
    // Property keys (before colon)
    { 
      regex: /"([^"\\]|\\.)*"(?=\s*:)/g, 
      className: "text-sky-400" 
    },
    // String values
    { 
      regex: /"([^"\\]|\\.)*"/g, 
      className: "text-amber-300" 
    },
    // Numbers
    { 
      regex: /\b(-?\d+\.?\d*(?:e[+-]?\d+)?)\b/gi, 
      className: "text-emerald-400" 
    },
    // Booleans and null
    { 
      regex: /\b(true|false|null)\b/g, 
      className: "text-rose-400" 
    },
    // Brackets and braces
    { 
      regex: /([{}\[\]])/g, 
      className: "text-gray-400" 
    },
  ];

  let result = escaped;

  // Apply patterns - we need to be careful not to double-replace
  // So we'll use a placeholder approach
  const placeholders: string[] = [];
  let placeholderIndex = 0;

  for (const { regex, className } of patterns) {
    result = result.replace(regex, (match) => {
      const placeholder = `__HIGHLIGHT_${placeholderIndex}__`;
      placeholders.push(`<span class="${className}">${match}</span>`);
      placeholderIndex++;
      return placeholder;
    });
  }

  // Replace placeholders with actual spans
  for (let i = 0; i < placeholders.length; i++) {
    const replacement = placeholders[i];
    if (replacement) {
      result = result.replace(`__HIGHLIGHT_${i}__`, replacement);
    }
  }

  return result;
}

export function JsonEditor({
  value,
  onChange,
  error,
  id,
  className,
  placeholder = '{\n  "event": "@string"\n}',
}: JsonEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  // Sync scroll between textarea and pre
  useEffect(() => {
    const textarea = textareaRef.current;
    const pre = preRef.current;
    if (!textarea || !pre) return;

    const handleScroll = () => {
      pre.scrollTop = textarea.scrollTop;
      pre.scrollLeft = textarea.scrollLeft;
    };

    textarea.addEventListener("scroll", handleScroll);
    return () => textarea.removeEventListener("scroll", handleScroll);
  }, []);

  // Ensure pre scrolls to match textarea on content change
  useEffect(() => {
    const textarea = textareaRef.current;
    const pre = preRef.current;
    if (textarea && pre) {
      pre.scrollTop = textarea.scrollTop;
      pre.scrollLeft = textarea.scrollLeft;
    }
  }, [value]);

  const highlighted = highlightJson(value);

  return (
    <div 
      className={cn(
        "relative font-mono text-xs rounded border",
        "bg-panel-bg",
        error ? "border-red-500/50" : "border-panel-border",
        // Focus-within to show ring when textarea is focused
        "focus-within:ring-2 focus-within:ring-brand-primary focus-within:border-transparent",
        className
      )}
    >
      {/* Highlighted layer (behind) - this is what the user sees */}
      <pre
        ref={preRef}
        aria-hidden="true"
        className={cn(
          "absolute inset-0 m-0 p-2 overflow-auto pointer-events-none",
          "whitespace-pre-wrap break-words",
          "leading-[1.5]",
          "text-gray-100" // base text color
        )}
        dangerouslySetInnerHTML={{ __html: highlighted || "&nbsp;" }}
      />
      
      {/* Textarea (front, completely transparent - user types here) */}
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        className={cn(
          "relative w-full h-full p-2 resize-none",
          "bg-transparent border-none outline-none",
          "text-transparent caret-gray-100",
          "placeholder:text-gray-600",
          "leading-[1.5]",
          "whitespace-pre-wrap break-words"
        )}
      />
    </div>
  );
}
