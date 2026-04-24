"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Clock } from "lucide-react";
import { useUserData } from "@/lib/userData";

const filterCategories = ["All", "Food", "Snacks", "Beverages", "Skincare", "Baby"];

interface SearchBarProps {
  onSearch: (query: string) => void;
  onCategoryChange: (category: string) => void;
  selectedCategory: string;
}

export function SearchBar({ onSearch, onCategoryChange, selectedCategory }: SearchBarProps) {
  const { data, addRecentSearch } = useUserData();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  const recentSearches = data.recentSearches;

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(query);
      if (query.trim().length >= 2) {
        void addRecentSearch(query);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, onSearch, addRecentSearch]);

  const handleRecent = (term: string) => {
    setQuery(term);
    setFocused(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      clearTimeout(debounceRef.current);
      onSearch(query);
      if (query.trim().length >= 2) {
        void addRecentSearch(query);
      }
      inputRef.current?.blur();
    }
  };

  return (
    <div className="space-y-3" role="search" aria-label="Search products">
      {/* Search input */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-oasis-muted z-10" aria-hidden="true" />
        <motion.input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="Search products, brands..."
          aria-label="Search products and brands"
          className="w-full pl-11 pr-10 py-3 rounded-2xl bg-oasis-card border border-oasis-border text-sm text-oasis-text placeholder:text-oasis-muted focus:outline-none focus:border-oasis-green/40 focus:ring-1 focus:ring-oasis-green/20 transition-all"
          animate={{ borderColor: focused ? "rgba(0,122,255,0.4)" : "#E5E5EA" }}
        />
        <AnimatePresence>
          {query && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-oasis-border flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oasis-green"
              aria-label="Clear search"
            >
              <X size={12} className="text-oasis-muted" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Recent searches */}
      <AnimatePresence>
        {focused && !query && recentSearches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-1"
            role="listbox"
            aria-label="Recent searches"
          >
            <p className="text-[11px] font-medium text-oasis-muted px-1">Recent</p>
            {recentSearches.map((term) => (
              <button
                key={term}
                onMouseDown={() => handleRecent(term)}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-oasis-card transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oasis-green"
                role="option"
                aria-label={`Search for ${term}`}
              >
                <Clock size={14} className="text-oasis-muted" aria-hidden="true" />
                <span className="text-sm text-oasis-text-secondary">{term}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1" role="radiogroup" aria-label="Filter by category">
        {filterCategories.map((cat) => (
          <motion.button
            key={cat}
            whileTap={{ scale: 0.95 }}
            onClick={() => onCategoryChange(selectedCategory === cat && cat !== "All" ? "All" : cat)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oasis-green ${
              selectedCategory === cat
                ? "bg-oasis-green text-oasis-black"
                : "bg-oasis-card border border-oasis-border text-oasis-muted hover:text-oasis-text"
            }`}
            role="radio"
            aria-checked={selectedCategory === cat}
            aria-label={`${cat} category${selectedCategory === cat ? " (selected)" : ""}`}
          >
            {cat}
            {selectedCategory === cat && cat !== "All" && (
              <span className="ml-1" aria-hidden="true">&times;</span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
