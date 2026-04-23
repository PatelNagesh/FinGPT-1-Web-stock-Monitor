/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis as ReXAxis, 
  YAxis as ReYAxis, 
  CartesianGrid as ReCartesianGrid, 
  Tooltip as ReTooltip, 
  ResponsiveContainer as ReResponsiveContainer,
  Cell
} from 'recharts';
import { 
  BarChart3, 
  BrainCircuit, 
  ChevronRight, 
  LayoutDashboard, 
  LayoutGrid,
  MessageSquareCode, 
  MonitorDot, 
  Settings, 
  ShieldCheck, 
  Zap,
  Github,
  Globe,
  TrendingUp,
  TrendingDown,
  Activity,
  Minus,
  Search,
  Plus,
  Trash2,
  RefreshCcw,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Bell,
  BellRing,
  X,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { MarketChart, TimeRange } from './components/FinanceChart';
import { NewsPanel } from './components/NewsPanel';
import { Forecaster } from './components/Forecaster';
import { SymbolSearch } from './components/SymbolSearch';
import { MarketHeatmap } from './components/MarketHeatmap';
import { getQuote, getCompanyNews, getMarketNews, getCandles, getCompanyProfile, isDemo, MarketQuote, CompanyProfile } from './services/marketService';
import { predictPrice, PricePrediction } from './services/geminiService';

const navItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'forecaster', icon: BrainCircuit, label: 'Sentiment Engine' },
  { id: 'intelligence', icon: MonitorDot, label: 'Market Analysis' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  type: 'above' | 'below';
  createdAt: number;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'alert';
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [watchlist, setWatchlist] = useState<string[]>(['NVDA', 'AAPL', 'TSLA', 'BTC']);
  const [selectedSymbol, setSelectedSymbol] = useState('NVDA');
  const [comparisonSymbols, setComparisonSymbols] = useState<string[]>(['NVDA']);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertInput, setAlertInput] = useState('');
  const [alertSettings, setAlertSettings] = useState({
    soundEnabled: true,
    allowedTypes: 'both' as 'both' | 'above' | 'below',
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('1D');
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | undefined>(undefined);
  const [marketData, setMarketData] = useState<{ 
    quote: MarketQuote | null, 
    news: any[], 
    candles: any[], 
    portfolioCandles: any[], 
    profile: CompanyProfile | null,
    watchlistQuotes: { [s: string]: { price: number, change: number } }
  }>({
    quote: null,
    news: [],
    candles: [],
    portfolioCandles: [],
    profile: null,
    watchlistQuotes: {}
  });
  const [prediction, setPrediction] = useState<PricePrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (symbols: string[], range: TimeRange, custom?: { from: string; to: string }) => {
    setLoading(true);
    setError(null);
    try {
      const to = Math.floor(Date.now() / 1000);
      let from = to - 86400;
      let resolution = '5';

      if (range === '5D') {
        from = to - 86400 * 5;
        resolution = '30';
      } else if (range === '1M') {
        from = to - 86400 * 30;
        resolution = 'D';
      } else if (range === '6M') {
        from = to - 86400 * 180;
        resolution = 'D';
      } else if (range === '1Y') {
        from = to - 86400 * 365;
        resolution = 'W';
      } else if (range === 'CUSTOM' && custom) {
        from = Math.floor(new Date(custom.from).getTime() / 1000);
        const customTo = Math.floor(new Date(custom.to).getTime() / 1000);
        resolution = (customTo - from) > 86400 * 60 ? 'W' : 'D';
      }

      // Fetch primary symbol data (quote, news, and profile)
      const primarySymbol = symbols[0];
      const [quote, news, profile] = await Promise.all([
        getQuote(primarySymbol),
        getCompanyNews(primarySymbol),
        getCompanyProfile(primarySymbol),
      ]);

      // Fetch candles for all symbols in the watchlist to build portfolio performance
      const uniqueSymbols = Array.from(new Set([...symbols, ...watchlist]));
      const candleRequests = uniqueSymbols.map(s => getCandles(s, resolution, from, to));
      const candlesList = await Promise.all(candleRequests);

      // Merge candles by time
      const mergedMap: { [time: string]: any } = {};
      const timeToTicks: { [time: string]: number } = {};
      
      candlesList.forEach((candles, index) => {
        const symbol = uniqueSymbols[index];
        if (candles.t) {
          candles.t.forEach((t: number, i: number) => {
            const timeKey = range === '1D' || range === '5D' 
              ? new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : new Date(t * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' });
            
            if (!mergedMap[timeKey]) {
              mergedMap[timeKey] = { time: timeKey };
              timeToTicks[timeKey] = t;
            }
            mergedMap[timeKey][symbol] = candles.c[i];
            if (symbol === primarySymbol && candles.v) {
              mergedMap[timeKey].volume = candles.v[i];
            }
          });
        }
      });

      // Sort and calculate portfolio aggregate
      const sortedTimes = Object.keys(timeToTicks).sort((a, b) => timeToTicks[a] - timeToTicks[b]);
      const lastPrices: { [s: string]: number } = {};
      const formattedCandles: any[] = [];
      const portfolioCandles: any[] = [];

      sortedTimes.forEach(time => {
        let portfolioSum = 0;
        watchlist.forEach(s => {
          if (mergedMap[time][s] !== undefined) {
             lastPrices[s] = mergedMap[time][s];
          }
          portfolioSum += lastPrices[s] || 0;
        });

        const row = { ...mergedMap[time] };
        formattedCandles.push(row);
        
        // Push only necessary info for the portfolio chart to keep it lightweight
        portfolioCandles.push({ 
          time: row.time, 
          portfolioValue: portfolioSum,
          portfolio: portfolioSum // Duplicate for MarketChart generic field handling if needed
        });
      });

      // Calculate relative changes for the ticker
      const watchlistQuotes: { [s: string]: { price: number, change: number } } = {};
      watchlist.forEach(s => {
        const symbolCandles = formattedCandles.filter(c => c[s] !== undefined);
        if (symbolCandles.length >= 2) {
          const current = symbolCandles[symbolCandles.length - 1][s];
          const prev = symbolCandles[symbolCandles.length - 2][s];
          watchlistQuotes[s] = {
            price: current,
            change: ((current / prev) - 1) * 100
          };
        } else if (symbolCandles.length === 1) {
          watchlistQuotes[s] = {
            price: symbolCandles[0][s],
            change: 0
          };
        }
      });

      setMarketData({ quote, news, candles: formattedCandles, portfolioCandles, profile, watchlistQuotes });
      setDemoMode(isDemo());
      
      // Check alerts after data fetch
      if (quote) {
        checkAlerts(primarySymbol, quote.c);
      }
    } catch (e: any) {
      console.error(e);
      let msg = e.message || 'Failed to fetch market data.';
      if (msg.includes('FINNHUB_API_KEY')) {
        setDemoMode(isDemo());
        setError(null); // Clear error in favor of demo mode notice
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(comparisonSymbols, timeRange, customRange);

    const interval = setInterval(() => {
      fetchData(comparisonSymbols, timeRange, customRange);
    }, 60000);

    return () => clearInterval(interval);
  }, [comparisonSymbols, timeRange, customRange, watchlist, fetchData]);

  const toggleComparison = (symbol: string) => {
    setPrediction(null); // Reset prediction when changing focus
    setComparisonSymbols(prev => {
       const isIncluded = prev.includes(symbol);
       if (isIncluded) {
         if (prev.length === 1) return prev;
         
         // If it's already primary, toggle it off
         if (symbol === prev[0]) {
           const filtered = prev.filter(s => s !== symbol);
           setSelectedSymbol(filtered[0]);
           return filtered;
         }
         
         // If included but not primary, make it primary
         const filtered = prev.filter(s => s !== symbol);
         setSelectedSymbol(symbol);
         return [symbol, ...filtered];
       }
       // If not included, add to front
       setSelectedSymbol(symbol);
       return [symbol, ...prev];
    });
  };

  const checkAlerts = useCallback((symbol: string, currentPrice: number) => {
    setAlerts(prev => {
      const triggered = prev.filter(a => {
        const matchesSymbol = a.symbol === symbol;
        const matchesTypeFilter = alertSettings.allowedTypes === 'both' || a.type === alertSettings.allowedTypes;
        if (!matchesSymbol || !matchesTypeFilter) return false;

        return (a.type === 'above' && currentPrice >= a.targetPrice) || 
               (a.type === 'below' && currentPrice <= a.targetPrice);
      });

      if (triggered.length > 0) {
        triggered.forEach(t => {
          const id = Math.random().toString(36).substr(2, 9);
          
          if (alertSettings.soundEnabled) {
            // Attempt to play a subtle notification sound (browser allowing)
            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
              audio.volume = 0.3;
              audio.play().catch(() => {});
            } catch (e) {}
          }

          setNotifications(prevNotif => [
            ...prevNotif,
            {
              id,
              title: `Price Alert: ${t.symbol}`,
              message: `${t.symbol} has reached your target of $${t.targetPrice}. Current price: $${currentPrice}`,
              type: 'alert'
            }
          ]);
          
          // Auto remove notification
          setTimeout(() => {
            setNotifications(p => p.filter(n => n.id !== id));
          }, 8000);
        });
        
        // Remove triggered alerts
        return prev.filter(a => !triggered.find(t => t.id === a.id));
      }
      return prev;
    });
  }, []);

  const addAlert = () => {
    const price = parseFloat(alertInput);
    if (isNaN(price) || !marketData.quote) return;

    const type = price > marketData.quote.c ? 'above' : 'below';
    const newAlert: PriceAlert = {
      id: Math.random().toString(36).substr(2, 9),
      symbol: selectedSymbol,
      targetPrice: price,
      type,
      createdAt: Date.now()
    };

    setAlerts(prev => [...prev, newAlert]);
    setAlertInput('');
    
    // Success notification
    const nid = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [
      ...prev,
      { id: nid, title: 'Alert Set', message: `Notifying when ${selectedSymbol} is ${type} $${price}`, type: 'success' }
    ]);
    setTimeout(() => setNotifications(p => p.filter(n => n.id !== nid)), 3000);
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handlePredict = async () => {
    if (!marketData.quote) return;
    setPredicting(true);
    try {
      const res = await predictPrice(selectedSymbol, marketData.quote, marketData.news);
      setPrediction(res);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'AI prediction failed.');
    } finally {
      setPredicting(false);
    }
  };

  const addToWatchlist = (symbol: string) => {
    setPrediction(null); // Reset prediction
    if (!watchlist.includes(symbol)) {
      setWatchlist(prev => [...prev, symbol]);
    }
    setComparisonSymbols(prev => {
      const filtered = prev.filter(s => s !== symbol);
      return [symbol, ...filtered];
    });
    setSelectedSymbol(symbol);
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist(prev => prev.filter(s => s !== symbol));
    if (selectedSymbol === symbol && watchlist.length > 1) {
      setSelectedSymbol(watchlist[0] === symbol ? watchlist[1] : watchlist[0]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] text-slate-900 font-sans overflow-hidden">
      {/* Top Navigation */}
      <nav className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Zap className="text-white w-4 h-4 fill-current" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800">
            FinGPT <span className="text-blue-600 font-medium">Terminal</span>
          </span>
          <div className="ml-6 flex items-center gap-4">
             <div className="h-8 w-px bg-slate-200"></div>
             <SymbolSearch onAdd={addToWatchlist} favorites={watchlist} />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={() => fetchData(comparisonSymbols, timeRange, customRange)}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-all active:rotate-180 duration-500"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold">
            {demoMode ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span className="text-amber-600 uppercase tracking-wider">Demo Mode</span>
              </>
            ) : (
              <>
                <span className={cn("w-2 h-2 rounded-full", loading ? "bg-amber-500 animate-pulse" : "bg-emerald-500")}></span>
                <span className="text-slate-500 uppercase tracking-wider">{loading ? 'Updating' : 'Live Mode'}</span>
              </>
            )}
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs shadow-sm">
               JD
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-50 border-r border-slate-200 p-6 flex flex-col gap-8 shrink-0">
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Core Modules</div>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg font-semibold text-sm transition-all",
                  activeTab === item.id 
                    ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-100" 
                    : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                )}
              >
                <item.icon className={cn("w-4 h-4", activeTab === item.id ? "text-blue-600" : "text-slate-400")} />
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between">
                <span>Watchlist</span>
                <span className="text-blue-500">{watchlist.length}</span>
             </div>
              <div className="space-y-1">
                {watchlist.map(symbol => (
                  <div 
                    key={symbol}
                    onClick={() => toggleComparison(symbol)}
                    className={cn(
                      "group flex items-center justify-between p-2 rounded-lg text-sm transition-all cursor-pointer relative overflow-hidden",
                      selectedSymbol === symbol ? "bg-white border border-slate-200 shadow-sm text-slate-900" : "text-slate-500 hover:bg-slate-200/30"
                    )}
                  >
                    {comparisonSymbols.includes(symbol) && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
                    )}
                    <div className="flex flex-col ml-1">
                      <span className="font-bold flex items-center gap-2">
                        {symbol}
                        {comparisonSymbols.includes(symbol) && <MonitorDot className="w-2.5 h-2.5 text-blue-500" />}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {comparisonSymbols.includes(symbol) ? 'Tracking Analysis' : 'Market Data Active'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                       <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromWatchlist(symbol);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
          </div>

          <div className="pt-6 border-t border-slate-200">
            <div className="bg-slate-900 rounded-xl p-4 shadow-lg ring-1 ring-slate-800">
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Portfolio Summary</div>
              <div className="text-lg font-bold text-white tracking-tight">$1.2M</div>
              <div className="text-[10px] text-emerald-400 font-bold mt-1 inline-flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +2.4%
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
          {error && (
            <div className="mx-8 mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600 text-sm animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          {demoMode && (
            <div className="mx-8 mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-between gap-3 text-amber-700 text-[10px] font-bold uppercase tracking-widest animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Running in Demo Mode • Provide FINNHUB_API_KEY in Secrets for live data</span>
              </div>
              <button 
                onClick={() => setActiveTab('settings')}
                className="px-3 py-1 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors"
              >
                Configure
              </button>
            </div>
          )}

          <div className="flex-1 overflow-auto p-8 space-y-6">
            <header className="flex items-end justify-between mb-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Market Deck</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 underline underline-offset-4">{selectedSymbol} Terminal</span>
                </div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                    {selectedSymbol} 
                    {marketData.quote && (
                      <span className={cn(
                        "text-sm px-2 py-1 rounded-lg font-bold",
                        marketData.quote.dp >= 0 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"
                      )}>
                        {marketData.quote.c} ({marketData.quote.dp >= 0 ? '+' : ''}{marketData.quote.dp.toFixed(2)}%)
                      </span>
                    )}
                  </h1>
                  {marketData.profile && (
                    <div className="flex items-center gap-2">
                       <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-md uppercase tracking-wider border border-slate-200">
                         {marketData.profile.finnhubIndustry}
                       </span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-500 font-medium">
                  {marketData.profile ? `${marketData.profile.name} • ${marketData.profile.exchange}` : 'AI-driven predictive modeling for high-performance trading.'}
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 pl-3 rounded-xl shadow-sm">
                  <Bell className="w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="number"
                    value={alertInput}
                    onChange={(e) => setAlertInput(e.target.value)}
                    placeholder="Alert Price"
                    className="w-24 bg-transparent border-none text-[10px] font-bold outline-none"
                  />
                  <button 
                    onClick={addAlert}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors"
                  >
                    Set Alert
                  </button>
                </div>
                <button 
                  onClick={handlePredict}
                  disabled={predicting || loading}
                  className={cn(
                    "px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2",
                    predicting && "opacity-80 animate-pulse"
                  )}
                >
                  {predicting ? <Loader2 className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                  Generate AI Prediction
                </button>
              </div>
            </header>

        {/* Notifications Overlay */}
        <div className="fixed top-20 right-8 z-50 flex flex-col gap-3 pointer-events-none">
          <AnimatePresence>
            {notifications.map(n => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                className={cn(
                  "p-4 rounded-2xl shadow-2xl border w-80 pointer-events-auto flex gap-3 items-start",
                  n.type === 'alert' ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                )}
              >
                <div className={cn(
                  "p-2 rounded-xl shrink-0",
                  n.type === 'alert' ? "bg-amber-500 text-white" : "bg-blue-50 text-blue-600"
                )}>
                  {n.type === 'alert' ? <BellRing className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-1 opacity-90">{n.title}</h4>
                  <p className="text-[10px] leading-relaxed opacity-70">{n.message}</p>
                </div>
                <button 
                  onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}
                  className="opacity-50 hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-4 gap-4 shrink-0">
                  {[
                    { label: 'Current Price', val: marketData.quote?.c || '...', status: marketData.quote?.pc || '...', sub: 'USD' },
                    { label: 'Day Range', val: `${marketData.quote?.l || '...'} - ${marketData.quote?.h || '...'}`, status: 'VOLATILE', sub: 'H/L' },
                    { label: 'Sentiment Index', val: prediction?.sentiment || '...', status: 'AI SCORE', sub: prediction ? `${(prediction.confidence * 100).toFixed(0)}% CONFIDENCE` : 'PENDING' },
                    { label: '7D Forecast', val: prediction?.targetPrice || '...', status: 'TARGET', sub: 'NEXT 7 DAYS' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</div>
                      <div className="text-xl font-bold text-slate-900 mb-1">{stat.val}</div>
                      <div className="flex items-center justify-between">
                         <span className="text-[9px] font-bold text-slate-300 uppercase">{stat.status}</span>
                         <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">{stat.sub}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-12 gap-6 min-h-0">
                  <div className="col-span-8 space-y-6">
                    {/* Active Alerts for selected symbol */}
                    {alerts.filter(a => a.symbol === selectedSymbol).length > 0 && (
                      <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
                        {alerts.filter(a => a.symbol === selectedSymbol).map(alert => (
                          <div 
                            key={alert.id}
                            className="shrink-0 bg-amber-50/50 border border-amber-100 px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-bold text-amber-700"
                          >
                            <Bell className="w-3 h-3" />
                            <span>Notify {alert.type} ${alert.targetPrice}</span>
                            <button 
                              onClick={() => removeAlert(alert.id)}
                              className="hover:text-rose-500 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 overflow-hidden ring-1 ring-slate-100">
                      <MarketChart 
                        symbols={comparisonSymbols} 
                        data={marketData.candles} 
                        activeRange={timeRange}
                        customRange={customRange}
                        onRangeChange={(range, custom) => {
                          setTimeRange(range);
                          if (custom) setCustomRange(custom);
                        }}
                      />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                              <BarChart3 className="w-5 h-5" />
                           </div>
                           <div>
                              <h3 className="font-bold text-slate-900 text-lg">Portfolio Cumulative Value</h3>
                              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-none">Aggregated Watchlist Units (1:1)</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Current Est.</div>
                           <div className="text-2xl font-black text-slate-900 tracking-tighter">
                             ${marketData.portfolioCandles[marketData.portfolioCandles.length - 1]?.portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                           </div>
                        </div>
                      </div>
                      <div className="h-[200px]">
                        <MarketChart 
                          symbols={['portfolioValue']}
                          data={marketData.portfolioCandles}
                          activeRange={timeRange}
                          loading={loading}
                          title="Portfolio Performance"
                          showControls={false}
                        />
                      </div>
                    </div>

                    {/* Volume Analysis Chart */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                      <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                          <Activity className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-lg">Trading Volume Analysis</h3>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-none">Standard Volume Units ({selectedSymbol})</p>
                        </div>
                      </div>
                      <div className="h-[200px]">
                        <ReResponsiveContainer width="100%" height="100%">
                          <BarChart data={marketData.candles}>
                            <ReCartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <ReXAxis 
                              dataKey="time" 
                              stroke="#94a3b8" 
                              fontSize={10} 
                              tickLine={false} 
                              axisLine={false}
                              dy={10}
                              minTickGap={30}
                            />
                            <ReYAxis 
                              stroke="#94a3b8" 
                              fontSize={10} 
                              tickLine={false} 
                              axisLine={false}
                              dx={-10}
                              tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : (val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val)}
                            />
                            <ReTooltip 
                              cursor={{fill: '#f8fafc'}}
                              content={({ active, payload, label }: any) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xl">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                                      <p className="text-sm font-black text-slate-900">{payload[0].value?.toLocaleString()} Units</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar 
                              dataKey="volume" 
                              radius={[4, 4, 0, 0]}
                              animationDuration={1500}
                            >
                              {marketData.candles.map((_entry, index) => {
                                const currentPrice = marketData.candles[index][selectedSymbol];
                                const prevPrice = index > 0 ? marketData.candles[index-1][selectedSymbol] : currentPrice;
                                const isUp = currentPrice >= prevPrice;
                                return <Cell key={`cell-${index}`} fill={isUp ? "#10b981" : "#ef4444"} fillOpacity={0.6} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ReResponsiveContainer>
                      </div>
                    </div>

                    {/* Market Performance Heatmap */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-900 flex items-center justify-center">
                            <LayoutGrid className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-lg">Market Performance Heatmap</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-none">Relative Watchlist Strength</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded bg-rose-500"></div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Weak</span>
                           </div>
                           <div className="w-12 h-1 bg-gradient-to-r from-rose-500 via-slate-200 to-emerald-500 rounded-full"></div>
                           <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Strong</span>
                              <div className="w-2 h-2 rounded bg-emerald-500"></div>
                           </div>
                        </div>
                      </div>
                      <div className="min-h-[200px]">
                        <MarketHeatmap 
                          data={marketData.watchlistQuotes} 
                          onSelect={toggleComparison}
                          loading={loading}
                        />
                      </div>
                    </div>

                    {prediction && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "bg-white border-2 rounded-3xl p-8 flex flex-col gap-6 shadow-xl relative overflow-hidden group transition-all duration-500",
                          prediction.sentiment === 'bullish' ? "border-emerald-600/20 shadow-emerald-500/10 shadow-xl" :
                          prediction.sentiment === 'bearish' ? "border-rose-600/20 shadow-rose-500/10 shadow-xl" :
                          "border-blue-600/10 shadow-blue-500/10 shadow-xl"
                        )}
                      >
                        <div className={cn(
                          "absolute -top-24 -right-24 w-64 h-64 blur-[100px] opacity-20 rounded-full transition-colors duration-700 pointer-events-none",
                          prediction.sentiment === 'bullish' ? "bg-emerald-400" :
                          prediction.sentiment === 'bearish' ? "bg-rose-400" :
                          "bg-blue-400"
                        )} />
                        <div className="absolute top-0 right-0 p-10 transform translate-x-8 -translate-y-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000 rotate-12">
                           <BrainCircuit className="w-48 h-48 text-blue-600" />
                        </div>
                        
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-200">
                              <Sparkles className="w-6 h-6 fill-current" />
                            </div>
                            <div>
                               <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900 text-xl tracking-tight leading-none mb-2">AI Signal Analysis</h3>
                                <div className="flex items-center gap-4">
                                  {/* Sentiment Gradient Indicator */}
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-[7px] font-bold text-slate-400 uppercase tracking-tighter w-24">
                                      <span>Bearish</span>
                                      <span>Neutral</span>
                                      <span>Bullish</span>
                                    </div>
                                    <div className="w-24 h-1 rounded-full bg-gradient-to-r from-rose-500 via-slate-200 to-emerald-500 relative">
                                      <motion.div 
                                        initial={{ left: "50%" }}
                                        animate={{ 
                                          left: prediction.sentiment === 'bullish' ? '90%' : 
                                                prediction.sentiment === 'bearish' ? '10%' : '50%' 
                                        }}
                                        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white border border-slate-900 rounded-full shadow-sm"
                                      />
                                    </div>
                                  </div>
                                  
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border flex items-center gap-1 shadow-sm",
                                    prediction.sentiment === 'bullish' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                    prediction.sentiment === 'bearish' ? "bg-rose-50 text-rose-700 border-rose-200" :
                                    "bg-slate-50 text-slate-700 border-slate-200"
                                  )}>
                                    {prediction.sentiment === 'bullish' && <TrendingUp className="w-2.5 h-2.5" />}
                                    {prediction.sentiment === 'bearish' && <TrendingDown className="w-2.5 h-2.5" />}
                                    {prediction.sentiment === 'neutral' && <Minus className="w-2.5 h-2.5" />}
                                    {prediction.sentiment}
                                  </span>
                                </div>
                               </div>
                            </div>
                          </div>
                           <div className="flex gap-6 items-center z-10">
                              {/* Circular Confidence Meter */}
                              <div className="flex flex-col items-center">
                                 <div className="relative w-14 h-14 flex items-center justify-center">
                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 50 50">
                                      <circle
                                        cx="25"
                                        cy="25"
                                        r="21"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        fill="transparent"
                                        className="text-slate-100"
                                      />
                                      <motion.circle
                                        cx="25"
                                        cy="25"
                                        r="21"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        fill="transparent"
                                        strokeDasharray={2 * Math.PI * 21}
                                        initial={{ strokeDashoffset: 2 * Math.PI * 21 }}
                                        animate={{ strokeDashoffset: 2 * Math.PI * 21 * (1 - prediction.confidence) }}
                                        strokeLinecap="round"
                                        className={cn(
                                          "transition-colors",
                                          prediction.confidence > 0.7 ? "text-blue-600" : 
                                          prediction.confidence > 0.4 ? "text-amber-500" : "text-rose-500"
                                        )}
                                      />
                                    </svg>
                                    <div className="absolute flex flex-col items-center justify-center">
                                       <span className="text-xs font-black text-slate-900 leading-none">{(prediction.confidence * 100).toFixed(0)}</span>
                                       <span className="text-[6px] font-bold text-slate-400 uppercase tracking-tighter">%</span>
                                    </div>
                                 </div>
                                 <div className={cn(
                                   "text-[7px] font-black uppercase tracking-widest mt-1.5 px-1.5 py-0.5 rounded",
                                   prediction.confidence > 0.7 ? "bg-blue-50 text-blue-600" : 
                                   prediction.confidence > 0.4 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                                 )}>
                                   {prediction.confidence > 0.7 ? 'Strong Signal' : prediction.confidence > 0.4 ? 'Moderate' : 'Speculative'}
                                 </div>
                              </div>

                              <div className={cn(
                                "text-right border rounded-3xl px-6 py-4 min-w-[150px] shadow-sm transition-colors",
                                prediction.sentiment === 'bullish' ? "bg-emerald-50/50 border-emerald-100" :
                                prediction.sentiment === 'bearish' ? "bg-rose-50/50 border-rose-100" :
                                "bg-slate-50/80 border-slate-100"
                              )}>
                                 <div className={cn(
                                   "text-[9px] font-black uppercase tracking-[0.2em] mb-1 flex items-center justify-end gap-1.5",
                                   prediction.sentiment === 'bullish' ? "text-emerald-600" :
                                   prediction.sentiment === 'bearish' ? "text-rose-600" :
                                   "text-blue-600"
                                 )}>
                                   <Zap className="w-3 h-3 fill-current" />
                                   Price Target
                                 </div>
                                 <div className="text-2xl font-black text-slate-900 tracking-tighter leading-none mb-1">${prediction.targetPrice.toFixed(2)}</div>
                                 <div className={cn(
                                   "text-[10px] font-bold uppercase flex items-center justify-end gap-1",
                                   prediction.targetPrice > (marketData.quote?.c || 0) ? "text-emerald-600" : "text-rose-600"
                                 )}>
                                   {prediction.targetPrice > (marketData.quote?.c || 0) ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                   {prediction.targetPrice > (marketData.quote?.c || 0) ? '+' : ''}{((prediction.targetPrice / (marketData.quote?.c || 1) - 1) * 100).toFixed(2)}% ROI
                                 </div>
                              </div>
                           </div>
                        </div>

                        {/* Price Range Visual Indicator */}
                        <div className="relative z-10 px-2 py-4">
                           <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                              <span>Current: ${marketData.quote?.c.toFixed(2)}</span>
                              <span>Target: ${prediction.targetPrice.toFixed(2)}</span>
                           </div>
                           <div className="h-4 bg-slate-50 rounded-lg border border-slate-100 flex items-center px-1">
                              <div className="flex-1 h-1 bg-slate-200 rounded-full relative">
                                 <motion.div 
                                    initial={{ left: "50%" }}
                                    animate={{ left: prediction.targetPrice > (marketData.quote?.o || 1) ? "85%" : "15%" }}
                                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-full shadow-md z-20"
                                 />
                                 <div className="absolute left-[50%] top-1/2 -translate-y-1/2 w-1 h-3 bg-slate-400 rounded-full z-10" />
                              </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                           <div className="space-y-4">
                              <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 backdrop-blur-sm h-full group/reason">
                                 <div className="flex items-center justify-between mb-4">
                                   <div className="flex items-center gap-2">
                                     <Activity className="w-4 h-4 text-blue-500" />
                                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Signal Logic</h4>
                                   </div>
                                   <div className="px-2 py-0.5 bg-white rounded-full border border-slate-200 text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                     Primary Evidence
                                   </div>
                                 </div>
                                 <p className="text-sm text-slate-700 leading-relaxed font-semibold">
                                   <span className="text-blue-600 opacity-20 text-4xl font-serif">"</span>
                                   {prediction.reasoning}
                                 </p>
                              </div>
                           </div>
                           <div className="space-y-4">
                              <div className="p-6 bg-blue-50/30 rounded-3xl border border-blue-100 backdrop-blur-sm h-full">
                                 <div className="flex items-center gap-2 mb-4">
                                   <AlertTriangle className="w-4 h-4 text-blue-400" />
                                   <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest font-mono">Risk Matrix</h4>
                                 </div>
                                 <ul className="space-y-3">
                                    {prediction.risks.map((risk, idx) => (
                                      <li key={idx} className="text-xs text-slate-700 flex items-start gap-3 font-semibold group/item">
                                        <div className="bg-blue-100 text-blue-600 rounded-lg p-1 group-hover/item:bg-blue-600 group-hover/item:text-white transition-colors">
                                          <ShieldCheck className="w-3 h-3" />
                                        </div>
                                        <span className="pt-0.5 leading-tight">{risk}</span>
                                      </li>
                                    ))}
                                 </ul>
                              </div>
                           </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                  <div className="col-span-4 h-full">
                    <NewsPanel news={marketData.news} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'forecaster' && (
              <div className="h-[calc(100vh-280px)]">
                <Forecaster symbol={selectedSymbol} watchlist={watchlist} />
              </div>
            )}
            
            {activeTab === 'intelligence' && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col items-center text-center max-w-2xl mx-auto shadow-sm">
                   <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                      <Activity className="w-8 h-8 text-blue-600" />
                   </div>
                   <h2 className="text-xl font-bold text-slate-900 mb-2">Deep Intelligence Feed</h2>
                   <p className="text-sm text-slate-500 mb-8">
                      Your FinGPT Terminal is now connected via a secure server-side proxy. The feed below aggregates high-impact news specifically filtered for your selected assets.
                   </p>
                   {error?.includes('FINNHUB_API_KEY') && (
                     <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-amber-700 text-xs font-medium mb-6 animate-pulse">
                        <AlertCircle className="w-4 h-4 mb-2 text-amber-600" />
                        <strong>Action Required:</strong> You need a Finnhub API Key for live data. Please add it to your <strong>Secrets</strong> panel as <code>FINNHUB_API_KEY</code>. Get a free key at <a href="https://finnhub.io/" target="_blank" className="underline decoration-amber-300">finnhub.io</a>.
                     </div>
                   )}
                </div>
                <div className="grid grid-cols-1 gap-6">
                   <div className="h-[600px]">
                      <NewsPanel news={marketData.news} />
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="max-w-2xl mx-auto space-y-8 py-8">
                <div className="space-y-4">
                   <h3 className="text-xl font-bold text-slate-900">Terminal Configuration</h3>
                   <p className="text-sm text-slate-500">Configure your data sources and environment variables for deep analysis.</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-6 shadow-sm">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Finnhub API Secret</label>
                      <div className="flex gap-2">
                         <input 
                            type="password" 
                            disabled 
                            value="********************"
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
                         />
                         <button className="px-4 py-2 text-blue-600 font-bold text-xs hover:underline uppercase tracking-widest">Connected</button>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Active Proxy: Server-Side Pipeline Enabled</p>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
                        To enable live trading data, configure <code>FINNHUB_API_KEY</code> in the <strong>Secrets</strong> panel of AI Studio. 
                        This terminal uses a secure Express.js backend to shield your tokens from browser exposure.
                      </p>
                   </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-6 shadow-sm">
                   <div className="flex items-center gap-2 mb-2">
                      <Bell className="w-4 h-4 text-blue-600" />
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Price Alert Preferences</h4>
                   </div>
                   
                   <div className="space-y-6">
                      <div className="flex items-center justify-between">
                         <div>
                            <p className="text-sm font-bold text-slate-800">Notification Sound</p>
                            <p className="text-[10px] text-slate-500 font-medium font-mono">Audible alert when thresholds are crossed</p>
                         </div>
                         <button 
                            onClick={() => setAlertSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
                            className={cn(
                               "w-10 h-5 rounded-full transition-all relative p-1",
                               alertSettings.soundEnabled ? "bg-blue-600" : "bg-slate-200"
                            )}
                         >
                            <div className={cn(
                               "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                               alertSettings.soundEnabled ? "left-6" : "left-1"
                            )}></div>
                         </button>
                      </div>

                      <div className="h-px bg-slate-100"></div>

                      <div className="space-y-4">
                         <p className="text-sm font-bold text-slate-800">Preferred Alert Types</p>
                         <div className="grid grid-cols-3 gap-2">
                            {[
                               { id: 'both', label: 'All Signals' },
                               { id: 'above', label: 'Resistance (Above)' },
                               { id: 'below', label: 'Support (Below)' }
                            ].map(option => (
                               <button 
                                  key={option.id}
                                  onClick={() => setAlertSettings(prev => ({ ...prev, allowedTypes: option.id as any }))}
                                  className={cn(
                                     "px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
                                     alertSettings.allowedTypes === option.id 
                                       ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm" 
                                       : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                                  )}
                               >
                                  {option.label}
                               </button>
                            ))}
                         </div>
                         <p className="text-[9px] text-slate-400 font-medium italic">
                            * Filtering preferences will suppress notifications even if alerts are active in the dashboard.
                         </p>
                      </div>
                   </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Ticker Footer */}
      <footer className="h-10 bg-slate-900 shrink-0 border-t border-slate-800 flex items-center overflow-hidden select-none relative z-50">
        <div className="flex items-center bg-slate-900 z-10 px-4 h-full border-r border-slate-800 shadow-[10px_0_15px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Market Feed</span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden relative h-full flex items-center">
          <div className="animate-marquee flex gap-12 items-center whitespace-nowrap px-6">
            {[...watchlist, ...watchlist].map((symbol, i) => {
              const data = marketData.watchlistQuotes[symbol];
              return (
                <div 
                  key={i} 
                  onClick={() => toggleComparison(symbol)}
                  className="flex gap-3 text-[10px] font-bold tracking-tight items-center cursor-pointer hover:bg-slate-800 px-3 py-1 rounded-md transition-colors"
                >
                  <span className="text-slate-400 uppercase font-black">{symbol}</span>
                  {data ? (
                    <>
                      <span className="text-white font-mono">${data.price.toFixed(2)}</span>
                      <span className={cn(
                        "flex items-center gap-0.5 font-bold",
                        data.change >= 0 ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {data.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)}%
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-600 animate-pulse font-mono">Loading...</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </footer>
    </div>
  );
}
