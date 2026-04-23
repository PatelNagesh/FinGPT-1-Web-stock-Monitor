import React from 'react';
import { cn } from '../lib/utils';
import { TrendingUp, TrendingDown, LayoutGrid } from 'lucide-react';
import { motion } from 'motion/react';

interface HeatmapItem {
  symbol: string;
  change: number;
  price: number;
}

interface MarketHeatmapProps {
  data: { [s: string]: { price: number, change: number } };
  onSelect: (symbol: string) => void;
  loading?: boolean;
}

export function MarketHeatmap({ data, onSelect, loading }: MarketHeatmapProps) {
  const items: HeatmapItem[] = Object.entries(data).map(([symbol, info]) => ({
    symbol,
    ...info
  }));

  const getIntensityColor = (change: number) => {
    const absChange = Math.abs(change);
    if (change > 0) {
      if (absChange > 4) return 'bg-emerald-600 text-white';
      if (absChange > 2) return 'bg-emerald-500 text-white';
      if (absChange > 1) return 'bg-emerald-400 text-white';
      return 'bg-emerald-100 text-emerald-900';
    } else if (change < 0) {
      if (absChange > 4) return 'bg-rose-600 text-white';
      if (absChange > 2) return 'bg-rose-500 text-white';
      if (absChange > 1) return 'bg-rose-400 text-white';
      return 'bg-rose-100 text-rose-900';
    }
    return 'bg-slate-100 text-slate-500';
  };

  if (items.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
        <LayoutGrid className="w-8 h-8 opacity-20" />
        <p className="text-[10px] font-bold uppercase tracking-widest">No heatmap data available</p>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 h-full", loading && "opacity-50 pointer-events-none transition-opacity")}>
      {items.map((item) => (
        <motion.div
          key={item.symbol}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(item.symbol)}
          className={cn(
            "relative rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all border border-transparent hover:shadow-lg hover:z-10 group",
            getIntensityColor(item.change)
          )}
        >
          <div className="flex justify-between items-start">
            <span className="text-sm font-black tracking-tighter uppercase">{item.symbol}</span>
            {item.change !== 0 && (
              item.change > 0 ? <TrendingUp className="w-3 h-3 opacity-60" /> : <TrendingDown className="w-3 h-3 opacity-60" />
            )}
          </div>
          <div className="mt-4">
             <div className="text-lg font-black tracking-tighter leading-none">${item.price.toFixed(2)}</div>
             <div className="text-[10px] font-bold mt-1 opacity-80 uppercase tracking-widest">
               {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
             </div>
          </div>
          
          {/* Subtle glow effect on hover */}
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity" />
        </motion.div>
      ))}
      
      {/* Skeleton / Placeholder for small lists to keep grid feel */}
      {items.length < 5 && Array.from({ length: 5 - items.length }).map((_, i) => (
        <div key={`placeholder-${i}`} className="border-2 border-dashed border-slate-100 rounded-2xl" />
      ))}
    </div>
  );
}
