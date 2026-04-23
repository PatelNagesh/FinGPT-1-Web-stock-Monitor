import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Loader2 } from 'lucide-react';
import { searchSymbols, SearchResult } from '../services/marketService';

interface SymbolSearchProps {
  onAdd: (symbol: string) => void;
  favorites: string[];
}

export function SymbolSearch({ onAdd, favorites }: SymbolSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 1) {
        setLoading(true);
        try {
          const res = await searchSymbols(query);
          setResults(res.slice(0, 8));
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative w-full max-w-md">
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
        <input
          type="text"
          value={query}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stocks (e.g. NVDA, AAPL)..."
          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all shadow-sm"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />}
      </div>

      {focused && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-50">
          {results.map((res) => (
            <div 
              key={res.symbol}
              onClick={() => {
                onAdd(res.symbol);
                setQuery('');
                setFocused(false);
              }}
              className="flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer transition-colors group"
            >
              <div>
                <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{res.symbol}</div>
                <div className="text-[10px] text-slate-500 truncate max-w-[200px]">{res.description}</div>
              </div>
              {favorites.includes(res.symbol) ? (
                <span className="text-[10px] font-bold text-emerald-500 uppercase">In Watchlist</span>
              ) : (
                <button className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-all">
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
