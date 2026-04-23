/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  BrainCircuit, 
  ChevronRight, 
  LayoutDashboard, 
  MessageSquareCode, 
  MonitorDot, 
  Settings, 
  ShieldCheck, 
  Zap,
  Github,
  Globe,
  TrendingUp,
  Activity,
  Search,
  Plus,
  Trash2,
  RefreshCcw,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { cn } from './lib/utils';
import { MarketChart, TimeRange } from './components/FinanceChart';
import { NewsPanel } from './components/NewsPanel';
import { Forecaster } from './components/Forecaster';
import { SymbolSearch } from './components/SymbolSearch';
import { getQuote, getCompanyNews, getMarketNews, getCandles, getCompanyProfile, isDemo, MarketQuote, CompanyProfile } from './services/marketService';
import { predictPrice, PricePrediction } from './services/geminiService';

const navItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'forecaster', icon: BrainCircuit, label: 'Sentiment Engine' },
  { id: 'intelligence', icon: MonitorDot, label: 'Market Analysis' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [watchlist, setWatchlist] = useState<string[]>(['NVDA', 'AAPL', 'TSLA', 'BTC']);
  const [selectedSymbol, setSelectedSymbol] = useState('NVDA');
  const [comparisonSymbols, setComparisonSymbols] = useState<string[]>(['NVDA']);
  const [timeRange, setTimeRange] = useState<TimeRange>('1D');
  const [marketData, setMarketData] = useState<{ quote: MarketQuote | null, news: any[], candles: any[], profile: CompanyProfile | null }>({
    quote: null,
    news: [],
    candles: [],
    profile: null
  });
  const [prediction, setPrediction] = useState<PricePrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (symbols: string[], range: TimeRange) => {
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
      } else if (range === '1Y') {
        from = to - 86400 * 365;
        resolution = 'W';
      }

      // Fetch primary symbol data (quote, news, and profile)
      const primarySymbol = symbols[0];
      const [quote, news, profile] = await Promise.all([
        getQuote(primarySymbol),
        getCompanyNews(primarySymbol),
        getCompanyProfile(primarySymbol),
      ]);

      // Fetch candles for all symbols in the comparison list
      const candleRequests = symbols.map(s => getCandles(s, resolution, from, to));
      const candlesList = await Promise.all(candleRequests);

      // Merge candles by time
      const mergedMap: { [time: string]: any } = {};
      const timeToTicks: { [time: string]: number } = {};
      
      candlesList.forEach((candles, index) => {
        const symbol = symbols[index];
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
          });
        }
      });

      const formattedCandles = Object.values(mergedMap).sort((a: any, b: any) => {
        return timeToTicks[a.time] - timeToTicks[b.time];
      });

      setMarketData({ quote, news, candles: formattedCandles, profile });
      setDemoMode(isDemo());
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
    fetchData(comparisonSymbols, timeRange);

    const interval = setInterval(() => {
      fetchData(comparisonSymbols, timeRange);
    }, 60000);

    return () => clearInterval(interval);
  }, [comparisonSymbols, timeRange, fetchData]);

  const toggleComparison = (symbol: string) => {
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
            onClick={() => fetchData(comparisonSymbols, timeRange)}
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
              <div className="flex gap-2">
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
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 overflow-hidden ring-1 ring-slate-100">
                      <MarketChart 
                        symbols={comparisonSymbols} 
                        data={marketData.candles} 
                        activeRange={timeRange}
                        onRangeChange={setTimeRange}
                      />
                    </div>
                    {prediction && (
                      <div className="bg-white border-2 border-blue-100 rounded-3xl p-8 flex flex-col gap-6 shadow-xl shadow-blue-50 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
                           <BrainCircuit className="w-32 h-32 text-blue-600" />
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200">
                            <Zap className="w-5 h-5 fill-current" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-lg">AI Prediction Model Results</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Model: Gemini 3.1 Pro Intelligence</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                           <div className="space-y-4">
                              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                 <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Technical Analysis</h4>
                                 <p className="text-sm text-slate-700 leading-relaxed font-medium">{prediction.reasoning}</p>
                              </div>
                           </div>
                           <div className="space-y-4">
                              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                                 <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Key Risk Factors</h4>
                                 <ul className="space-y-2">
                                    {prediction.risks.map((risk, idx) => (
                                      <li key={idx} className="text-xs text-slate-600 flex items-center gap-2 font-medium">
                                        <span className="w-1.5 h-1.5 bg-blue-300 rounded-full"></span> {risk}
                                      </li>
                                    ))}
                                 </ul>
                              </div>
                           </div>
                        </div>
                      </div>
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
              </div>
            )}
          </div>

          {/* Ticker Footer */}
          <footer className="h-10 bg-slate-900 shrink-0 border-t border-slate-800 flex items-center px-6 overflow-hidden select-none">
            <div className="animate-marquee flex gap-12 items-center whitespace-nowrap">
              {watchlist.map((symbol, i) => (
                <div 
                  key={i} 
                  onClick={() => setSelectedSymbol(symbol)}
                  className="flex gap-2 text-[10px] font-bold tracking-tight items-center cursor-pointer hover:bg-slate-800 px-2 py-1 rounded transition-colors"
                >
                  <span className="text-slate-500 uppercase">{symbol}</span>
                  <span className="text-white font-mono">LIVE</span>
                </div>
              ))}
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
