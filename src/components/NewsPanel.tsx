import { Newspaper, TrendingUp, TrendingDown, Clock, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';

export function NewsPanel({ news }: { news: any[] }) {
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
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Market Intelligence</h3>
      </div>
      <div className="overflow-y-auto flex-1 space-y-6 pr-2 custom-scrollbar">
        {news.map((item, i) => (
          <a 
            key={i} 
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
            <h4 className="text-xs font-bold text-white leading-relaxed mb-2 line-clamp-2">
              {item.headline}
            </h4>
            <p className="text-[10px] text-slate-500 line-clamp-2 mb-2 leading-tight">
              {item.summary}
            </p>
          </a>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t border-slate-800">
        <p className="text-[9px] text-slate-500 uppercase tracking-widest text-center font-bold">Powered by Finnhub API</p>
      </div>
    </div>
  );
}
