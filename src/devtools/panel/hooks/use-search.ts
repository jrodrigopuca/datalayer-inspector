/**
 * useSearch hook - search and filter functionality
 */

import { useEffect, useRef } from "react";
import { usePanelStore } from "../store";
import { TIMING } from "@shared/constants";

/**
 * Get search state and actions
 */
export function useSearch(): {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilter: string | null;
  setActiveFilter: (filter: string | null) => void;
  clearSearch: () => void;
} {
  const searchQuery = usePanelStore((s) => s.searchQuery);
  const setSearchQuery = usePanelStore((s) => s.setSearchQuery);
  const activeFilter = usePanelStore((s) => s.activeFilter);
  const setActiveFilter = usePanelStore((s) => s.setActiveFilter);

  function clearSearch(): void {
    setSearchQuery("");
    setActiveFilter(null);
  }

  return {
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    clearSearch,
  };
}

/**
 * Debounced search input handling
 */
export function useDebouncedSearch(): {
  inputValue: string;
  setInputValue: (value: string) => void;
} {
  const setSearchQuery = usePanelStore((s) => s.setSearchQuery);
  const inputValueRef = useRef("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync initial value
  const searchQuery = usePanelStore((s) => s.searchQuery);
  if (inputValueRef.current === "" && searchQuery !== "") {
    inputValueRef.current = searchQuery;
  }

  function setInputValue(value: string): void {
    inputValueRef.current = value;

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

  return {
    inputValue: inputValueRef.current,
    setInputValue,
  };
}
