import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Calendar } from 'lucide-react';
import { cn } from '../lib/utils';

const defaultData = [
  { time: '09:30', price: 420.5 },
  { time: '10:00', price: 422.1 },
  { time: '10:30', price: 421.8 },
  { time: '11:00', price: 425.4 },
  { time: '11:30', price: 423.9 },
  { time: '12:00', price: 426.2 },
  { time: '12:30', price: 428.1 },
  { time: '13:00', price: 427.5 },
  { time: '13:30', price: 429.3 },
  { time: '14:00', price: 431.0 },
  { time: '14:30', price: 430.5 },
  { time: '15:00', price: 432.8 },
  { time: '15:30', price: 431.9 },
  { time: '16:00', price: 433.5 },
];

const PILL_COLORS = [
  '#2563eb', // blue
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ef4444', // rose
  '#06b6d4', // cyan
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xl min-w-[120px]">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div 
                  className="w-1.5 h-1.5 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                ></div>
                <span className="text-[10px] font-bold text-slate-600 uppercase">{entry.name}</span>
              </div>
              <span className="text-xs font-bold text-slate-900">${entry.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export type TimeRange = '1D' | '5D' | '1M' | '6M' | '1Y' | 'CUSTOM';

interface MarketChartProps {
  symbols: string[];
  data?: any[];
  activeRange?: TimeRange;
  customRange?: { from: string; to: string };
  onRangeChange?: (range: TimeRange, custom?: { from: string; to: string }) => void;
}

export function MarketChart({ symbols, data, activeRange = '1D', customRange, onRangeChange }: MarketChartProps) {
  const [chartData, setChartData] = React.useState(data || defaultData);
  const [localCustomFrom, setLocalCustomFrom] = React.useState(customRange?.from || '');
  const [localCustomTo, setLocalCustomTo] = React.useState(customRange?.to || '');

  React.useEffect(() => {
    if (data) setChartData(data);
  }, [data]);

  const ranges: TimeRange[] = ['1D', '5D', '1M', '6M', '1Y'];

  const handleApplyCustom = () => {
    if (localCustomFrom && localCustomTo) {
      onRangeChange?.('CUSTOM', { from: localCustomFrom, to: localCustomTo });
    }
  };

  return (
    <div className="h-[400px] w-full bg-white p-4">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
        <div className="space-y-2">
          <div>
            <h3 className="font-bold text-slate-800 text-sm tracking-tight">Market Benchmarking</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Relative Performance</p>
          </div>
          <div className="flex flex-wrap gap-2">
             {symbols.map((s, i) => (
               <div key={s} className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-100 bg-slate-50">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PILL_COLORS[i % PILL_COLORS.length] }}></div>
                  <span className="text-[10px] font-bold text-slate-600">{s}</span>
               </div>
             ))}
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => onRangeChange?.(r)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all",
                  activeRange === r 
                    ? "bg-white text-blue-600 shadow-sm border border-slate-200" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {r}
              </button>
            ))}
            <button
               onClick={() => onRangeChange?.('CUSTOM')}
               className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1",
                activeRange === 'CUSTOM'
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Calendar className="w-3 h-3" />
              Custom
            </button>
          </div>

          {activeRange === 'CUSTOM' && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <input 
                type="date" 
                value={localCustomFrom}
                onChange={(e) => setLocalCustomFrom(e.target.value)}
                className="text-[10px] p-1.5 bg-white border border-slate-200 rounded text-slate-600"
              />
              <span className="text-slate-300 text-xs">to</span>
              <input 
                type="date" 
                value={localCustomTo}
                onChange={(e) => setLocalCustomTo(e.target.value)}
                className="text-[10px] p-1.5 bg-white border border-slate-200 rounded text-slate-600"
              />
              <button 
                onClick={handleApplyCustom}
                className="p-1.5 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height="75%">
        <AreaChart data={chartData}>
          <defs>
            {symbols.map((s, i) => (
              <linearGradient key={s} id={`color${s}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PILL_COLORS[i % PILL_COLORS.length]} stopOpacity={0.1}/>
                <stop offset="95%" stopColor={PILL_COLORS[i % PILL_COLORS.length]} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="time" 
            stroke="#94a3b8" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false}
            dy={10}
            minTickGap={30}
          />
          <YAxis 
            stroke="#94a3b8" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false}
            domain={['auto', 'auto']}
            dx={-10}
            tickFormatter={(val) => `$${val}`}
          />
          <Tooltip content={<CustomTooltip />} />
          {symbols.map((s, i) => (
            <Area 
              key={s}
              name={s}
              type="monotone" 
              dataKey={s} 
              stroke={PILL_COLORS[i % PILL_COLORS.length]} 
              strokeWidth={symbols.length > 1 ? 2 : 3}
              fillOpacity={1} 
              fill={`url(#color${s})`} 
              animationDuration={1000}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
