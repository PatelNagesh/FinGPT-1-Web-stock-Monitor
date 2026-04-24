import React, { useState, useMemo } from 'react';
import { Newspaper, TrendingUp, TrendingDown, Clock, ExternalLink, ChevronDown, ChevronUp, Filter, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export function NewsPanel({ news }: { news: any[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [selectedSource, setSelectedSource] = useState<string>('All');

  const sources = useMemo(() => {
    const uniqueSources = new Set<string>();
    news.forEach(item => {
      if (item.source) uniqueSources.add(item.source);
    });
    return ['All', ...Array.from(uniqueSources).sort()];
  }, [news]);

  const filteredNews = useMemo(() => {
    if (selectedSource === 'All') return news;
    return news.filter(item => item.source === selectedSource);
  }, [news, selectedSource]);

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  if (!news || news.length === 0) {
    return (
      <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col h-full items-center justify-center text-center opacity-50">
        <Clock className="w-8 h-8 mb-2" />
        <p className="text-xs font-mono uppercase">No news available</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col h-full overflow-hidden shadow-2xl shadow-slate-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Market Intelligence</h3>
        </div>
      </div>

      {/* Source Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar border-b border-white/5 mb-6">
        <Filter className="w-3 h-3 text-slate-500 shrink-0" />
        {sources.map(source => (
          <button
            key={source}
            onClick={() => setSelectedSource(source)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all whitespace-nowrap border shrink-0",
              selectedSource === source
                ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/40"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600"
            )}
          >
            {source}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto flex-1 space-y-6 pr-2 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {filteredNews.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              className="text-center py-10"
            >
              <Clock className="w-8 h-8 mx-auto mb-2 text-slate-500" />
              <p className="text-xs font-mono uppercase text-slate-500">No results from {selectedSource}</p>
            </motion.div>
          ) : (
            filteredNews.map((item, i) => {
              const isExpanded = expandedIds.has(item.id);
              return (
                <motion.a 
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  key={item.id || i} 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block border-l-2 border-slate-700 pl-4 py-1 hover:border-blue-500 transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      {new Date(item.datetime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {item.source}
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                  <h4 className="text-xs font-bold text-white leading-relaxed mb-2 break-words">
                    {item.headline}
                  </h4>
                  
                  <div className="space-y-2">
                    <motion.p 
                      initial={false}
                      animate={{ height: isExpanded ? "auto" : "2.5em" }}
                      className={cn(
                        "text-[10px] text-slate-500 leading-tight overflow-hidden break-words",
                        !isExpanded && "line-clamp-2"
                      )}
                    >
                      {item.summary}
                    </motion.p>
                    
                    <button
                      onClick={(e) => toggleExpand(item.id, e)}
                      className="flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest"
                    >
                      {isExpanded ? (
                        <>Show Less <ChevronUp className="w-3 h-3" /></>
                      ) : (
                        <>Read More <ChevronDown className="w-3 h-3" /></>
                      )}
                    </button>
                  </div>
                </motion.a>
              );
            })
          )}
        </AnimatePresence>
      </div>
      <div className="mt-6 pt-4 border-t border-slate-800">
        <p className="text-[9px] text-slate-500 uppercase tracking-widest text-center font-bold">Powered by Finnhub API</p>
      </div>
    </div>
  );
}
