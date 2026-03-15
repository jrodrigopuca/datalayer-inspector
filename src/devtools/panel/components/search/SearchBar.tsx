/**
 * SearchBar component
 */

import { useState, useRef, useEffect } from "react";
import { useSearch } from "../../hooks";
import { usePanelStore } from "../../store";
import { TIMING } from "@shared/constants";
import { cn } from "@/lib/utils";

const FILTER_OPTIONS = [
  { value: null, label: "All events" },
  { value: "gtm", label: "GTM only" },
  { value: "ecommerce", label: "Ecommerce" },
  { value: "custom", label: "Custom" },
] as const;

export function SearchBar() {
  const { searchQuery, activeFilter, setActiveFilter, clearSearch } =
    useSearch();
  const setSearchQuery = usePanelStore((s) => s.setSearchQuery);

  // Local state for debounced input
  const [inputValue, setInputValue] = useState(searchQuery);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external changes
  useEffect(() => {
    if (searchQuery !== inputValue) {
      setInputValue(searchQuery);
    }
  }, [searchQuery]);

  function handleInputChange(value: string): void {
    setInputValue(value);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce the store update
    timeoutRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, TIMING.SEARCH_DEBOUNCE);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const hasFilters = inputValue.length > 0 || activeFilter !== null;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 border-b border-panel-border">
      {/* Search input */}
      <div className="relative flex-1">
        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search events... (press / to focus)"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          data-search-input
          className={cn(
            "w-full h-7 pl-8 pr-8 text-sm bg-panel-bg text-gray-200 rounded border border-panel-border",
            "placeholder:text-gray-500",
            "focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
          )}
        />
        {inputValue.length > 0 && (
          <button
            onClick={() => {
              setInputValue("");
              setSearchQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <ClearIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter dropdown */}
      <select
        value={activeFilter ?? ""}
        onChange={(e) =>
          setActiveFilter(e.target.value === "" ? null : e.target.value)
        }
        className={cn(
          "h-7 px-2 text-sm bg-panel-bg text-gray-200 rounded border border-panel-border",
          "focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
        )}
      >
        {FILTER_OPTIONS.map((option) => (
          <option key={option.value ?? "all"} value={option.value ?? ""}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Clear all filters */}
      {hasFilters && (
        <button
          onClick={clearSearch}
          className="text-xs text-gray-400 hover:text-gray-200"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function ClearIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
