import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Loader2 } from 'lucide-react';
import { searchSymbols, getCompanyProfile, SearchResult } from '../services/marketService';

type SearchResultWithProfile = SearchResult & { industry?: string };

interface SymbolSearchProps {
  onAdd: (symbol: string) => void;
  favorites: string[];
}

export function SymbolSearch({ onAdd, favorites }: SymbolSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 1) {
        setLoading(true);
        try {
          const res = await searchSymbols(query);
          const topResults = res.slice(0, 5);
          
          // Enhanced: Fetch profiles for top results to show sector/industry
          const resultsWithProfiles = await Promise.all(
            topResults.map(async (item) => {
              try {
                // Only fetch for stocks to save tokens
                if (item.type === 'Common Stock') {
                  const profile = await getCompanyProfile(item.symbol);
                  return { ...item, industry: profile.finnhubIndustry };
                }
              } catch (err) {
                console.warn(`Could not fetch profile for ${item.symbol}`);
              }
              return item;
            })
          );

          setResults(resultsWithProfiles);
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
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{res.symbol}</span>
                  {res.industry && (
                    <span className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest border border-blue-100">
                      {res.industry}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 truncate max-w-[240px] font-medium">{res.description}</div>
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
