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
  Area,
  ComposedChart
} from 'recharts';
import { Calendar, Settings2, Activity, Info } from 'lucide-react';
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

const INDICATOR_COLORS = {
  SMA: '#f59e0b',
  EMA: '#ef4444',
  RSI: '#8b5cf6'
};

const CustomTooltip = ({ active, payload, label, isNormalized }: any) => {
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
              <span className="text-xs font-bold text-slate-900">
                {entry.name === 'RSI' ? '' : (isNormalized ? '' : '$')}{entry.value.toFixed(2)}{isNormalized && entry.name !== 'RSI' ? '%' : ''}
              </span>
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
  title?: string;
  showControls?: boolean;
  loading?: boolean;
  isNormalized?: boolean;
}

// Indicator Calculation Helpers
const calculateSMA = (data: any[], key: string, period: number) => {
  return data.map((_, idx, arr) => {
    if (idx < period - 1) return null;
    const slice = arr.slice(idx - period + 1, idx + 1);
    const sum = slice.reduce((acc, curr) => acc + (curr[key] || 0), 0);
    return sum / period;
  });
};

const calculateEMA = (data: any[], key: string, period: number) => {
  const k = 2 / (period + 1);
  let ema = null;
  return data.map((curr, idx) => {
    const val = curr[key] || 0;
    if (idx === 0) {
      ema = val;
      return ema;
    }
    ema = (val * k) + (ema * (1 - k));
    return ema;
  });
};

const calculateRSI = (data: any[], key: string, period: number) => {
  let avgGain = 0;
  let avgLoss = 0;
  
  return data.map((curr, idx, arr) => {
    if (idx === 0) return null;
    
    const diff = (curr[key] || 0) - (arr[idx - 1][key] || 0);
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    
    if (idx < period) {
      avgGain += gain;
      avgLoss += loss;
      if (idx === period - 1) {
        avgGain /= period;
        avgLoss /= period;
      }
      return null;
    }
    
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  });
};

export function MarketChart({ 
  symbols, 
  data, 
  activeRange = '1D', 
  customRange, 
  onRangeChange,
  title = "Market Benchmarking",
  showControls = true,
  loading = false,
  isNormalized = false
}: MarketChartProps) {
  const [chartData, setChartData] = React.useState(data || defaultData);
  const [localCustomFrom, setLocalCustomFrom] = React.useState(customRange?.from || '');
  const [localCustomTo, setLocalCustomTo] = React.useState(customRange?.to || '');
  
  const [showIndicators, setShowIndicators] = React.useState(false);
  const [indicatorOptions, setIndicatorOptions] = React.useState({
    showSMA: false,
    smaPeriod: 20,
    showEMA: false,
    emaPeriod: 20,
    showRSI: false,
    rsiPeriod: 14
  });

  const processedData = React.useMemo(() => {
    let result = [...chartData];
    
    if (isNormalized && result.length > 0) {
      // Find first valid price for each symbol to use as basis
      const basePrices: Record<string, number> = {};
      symbols.forEach(s => {
        const firstCandle = result.find(c => c[s] && c[s] > 0);
        if (firstCandle) basePrices[s] = firstCandle[s];
      });

      result = result.map(candle => {
        const normalizedPoint = { ...candle };
        symbols.forEach(s => {
          if (candle[s] && basePrices[s]) {
            normalizedPoint[s] = ((candle[s] / basePrices[s]) - 1) * 100;
          }
        });
        return normalizedPoint;
      });
    }

    // Add Indicators (only for the primary symbol if selected, or first symbol)
    if (symbols.length > 0) {
      const primarySymbol = symbols[0];
      
      if (indicatorOptions.showSMA) {
        const smaValues = calculateSMA(result, primarySymbol, indicatorOptions.smaPeriod);
        result = result.map((item, i) => ({ ...item, SMA: smaValues[i] }));
      }
      
      if (indicatorOptions.showEMA) {
        const emaValues = calculateEMA(result, primarySymbol, indicatorOptions.emaPeriod);
        result = result.map((item, i) => ({ ...item, EMA: emaValues[i] }));
      }
      
      if (indicatorOptions.showRSI) {
        const rsiValues = calculateRSI(result, primarySymbol, indicatorOptions.rsiPeriod);
        result = result.map((item, i) => ({ ...item, RSI: rsiValues[i] }));
      }
    }

    return result;
  }, [chartData, symbols, isNormalized, indicatorOptions]);

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
    <div className={cn("w-full bg-white transition-opacity duration-300", loading ? "opacity-50" : "opacity-100")}>
      {showControls && (
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm tracking-tight">{title}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Relative Performance</p>
              </div>
              <div className="relative">
                <button 
                  onClick={() => setShowIndicators(!showIndicators)}
                  className={cn(
                    "p-2 rounded-xl transition-all flex items-center gap-2",
                    showIndicators ? "bg-slate-900 text-white shadow-lg" : "bg-slate-50 text-slate-400 hover:text-slate-600 border border-slate-100"
                  )}
                >
                  <Settings2 className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">Indicators</span>
                </button>

                {showIndicators && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-50">
                      <Activity className="w-4 h-4 text-blue-600" />
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Technical Overlays</h4>
                    </div>
                    
                    <div className="space-y-4">
                      {/* SMA */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={indicatorOptions.showSMA}
                              onChange={(e) => setIndicatorOptions(prev => ({ ...prev, showSMA: e.target.checked }))}
                              className="w-3 h-3 rounded text-blue-600"
                            />
                            <span className="text-[10px] font-bold text-slate-700 uppercase">SMA (Moving Avg)</span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: INDICATOR_COLORS.SMA }}></div>
                          </div>
                        </div>
                        {indicatorOptions.showSMA && (
                          <div className="flex items-center gap-2 pl-5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Period:</span>
                            <input 
                              type="number" 
                              value={indicatorOptions.smaPeriod}
                              onChange={(e) => setIndicatorOptions(prev => ({ ...prev, smaPeriod: parseInt(e.target.value) || 20 }))}
                              className="w-12 text-[10px] border border-slate-100 rounded px-1"
                            />
                          </div>
                        )}
                      </div>

                      {/* EMA */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={indicatorOptions.showEMA}
                              onChange={(e) => setIndicatorOptions(prev => ({ ...prev, showEMA: e.target.checked }))}
                              className="w-3 h-3 rounded text-blue-600"
                            />
                            <span className="text-[10px] font-bold text-slate-700 uppercase">EMA (Exponential)</span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: INDICATOR_COLORS.EMA }}></div>
                          </div>
                        </div>
                        {indicatorOptions.showEMA && (
                          <div className="flex items-center gap-2 pl-5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Period:</span>
                            <input 
                              type="number" 
                              value={indicatorOptions.emaPeriod}
                              onChange={(e) => setIndicatorOptions(prev => ({ ...prev, emaPeriod: parseInt(e.target.value) || 20 }))}
                              className="w-12 text-[10px] border border-slate-100 rounded px-1"
                            />
                          </div>
                        )}
                      </div>

                      {/* RSI */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={indicatorOptions.showRSI}
                              onChange={(e) => setIndicatorOptions(prev => ({ ...prev, showRSI: e.target.checked }))}
                              className="w-3 h-3 rounded text-blue-600"
                            />
                            <span className="text-[10px] font-bold text-slate-700 uppercase">RSI (Relative Strength)</span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: INDICATOR_COLORS.RSI }}></div>
                          </div>
                        </div>
                        {indicatorOptions.showRSI && (
                          <div className="flex items-center gap-2 pl-5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Period:</span>
                            <input 
                              type="number" 
                              value={indicatorOptions.rsiPeriod}
                              onChange={(e) => setIndicatorOptions(prev => ({ ...prev, rsiPeriod: parseInt(e.target.value) || 14 }))}
                              className="w-12 text-[10px] border border-slate-100 rounded px-1"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center gap-2">
                      <Info className="w-3 h-3 text-slate-300" />
                      <p className="text-[8px] text-slate-400 font-medium">Applied to primary symbol: <span className="font-bold">{symbols[0]}</span></p>
                    </div>
                  </div>
                )}
              </div>
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
      )}
      <div className={cn("w-full", showControls ? "h-[350px]" : "h-full")}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={processedData}>
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
              yAxisId="left"
              stroke="#94a3b8" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              domain={['auto', 'auto']}
              dx={-10}
              tickFormatter={(val) => isNormalized ? `${val}%` : `$${val}`}
            />
            {indicatorOptions.showRSI && (
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#8b5cf6" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                domain={[0, 100]}
                dx={10}
                tickCount={5}
              />
            )}
            <Tooltip content={<CustomTooltip isNormalized={isNormalized} />} />
            {symbols.map((s, i) => (
              <Area 
                key={s}
                yAxisId="left"
                name={s === 'portfolioValue' ? 'Portfolio' : s}
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
            
            {/* Indicators */}
            {indicatorOptions.showSMA && (
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="SMA" 
                stroke={INDICATOR_COLORS.SMA} 
                strokeWidth={1.5} 
                dot={false}
                name={`SMA (${indicatorOptions.smaPeriod})`}
                strokeDasharray="5 5"
              />
            )}
            {indicatorOptions.showEMA && (
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="EMA" 
                stroke={INDICATOR_COLORS.EMA} 
                strokeWidth={1.5} 
                dot={false}
                name={`EMA (${indicatorOptions.emaPeriod})`}
              />
            )}
            {indicatorOptions.showRSI && (
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="RSI" 
                stroke={INDICATOR_COLORS.RSI} 
                strokeWidth={1.5} 
                dot={false}
                name="RSI"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
