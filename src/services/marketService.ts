// We now use a server-side proxy to keep API keys secure and hide them from the browser
const API_BASE = '/api/market';

export interface MarketQuote {
  c: number; // Current price
  d: number; // Change
  dp: number; // Percent change
  h: number; // High
  l: number; // Low
  o: number; // Open
  pc: number; // Previous close
}

export interface NewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface SearchResult {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

export interface CompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  name: string;
  ticker: string;
  ipo: string;
  marketCapitalization: number;
  shareOutstanding: number;
  logo: string;
  phone: string;
  weburl: string;
  finnhubIndustry: string;
}

// Mock data for demo mode
const MOCK_DATA: Record<string, any> = {
  'NVDA': {
    quote: { c: 880.45, d: 15.2, dp: 1.75, h: 890.0, l: 865.2, o: 870.1, pc: 865.25 },
    profile: { name: 'NVIDIA Corp', finnhubIndustry: 'Semiconductors', exchange: 'NASDAQ' },
    news: [{ headline: 'NVIDIA Announces New AI Chip Architecture', summary: 'The new Blackwell platform promise a massive leap in processing power for AI workloads.', datetime: Date.now() / 1000, source: 'FinGPT News', id: 1 }]
  },
  'AAPL': {
    quote: { c: 175.12, d: -1.05, dp: -0.6, h: 177.0, l: 174.5, o: 176.5, pc: 176.17 },
    profile: { name: 'Apple Inc', finnhubIndustry: 'Technology', exchange: 'NASDAQ' },
    news: [{ headline: 'Apple Expands Services Division', summary: 'New subscription tiers and features are expected in the upcoming keynote.', datetime: Date.now() / 1000, source: 'FinGPT News', id: 2 }]
  },
  'TSLA': {
    quote: { c: 168.45, d: 3.25, dp: 1.95, h: 172.0, l: 165.0, o: 166.0, pc: 165.2 },
    profile: { name: 'Tesla Inc', finnhubIndustry: 'Automobiles', exchange: 'NASDAQ' },
    news: [{ headline: 'Tesla Ramps Up Giga Texas Production', summary: 'Monthly output targets have been exceeded according to leaked internals.', datetime: Date.now() / 1000, source: 'FinGPT News', id: 3 }]
  },
  'BTC': {
    quote: { c: 68500.0, d: 1200.0, dp: 1.78, h: 69000.0, l: 66000.0, o: 67300.0, pc: 67300.0 },
    profile: { name: 'Bitcoin', finnhubIndustry: 'Cryptocurrency', exchange: 'Coinbase' },
    news: [{ headline: 'Bitcoin ETF Inflows Hit Record High', summary: 'Institutional demand continues to drive liquidity into the primary crypto asset.', datetime: Date.now() / 1000, source: 'FinGPT News', id: 4 }]
  }
};

let isDemoMode = false;
export const isDemo = () => isDemoMode;

async function fetchWithError(url: string, symbolHint?: string) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      // If the error is about missing key, and we have mock data, use it
      if (data.error?.includes('FINNHUB_API_KEY') && symbolHint && MOCK_DATA[symbolHint]) {
        isDemoMode = true;
        console.warn(`API Key missing. Using demo data for ${symbolHint}`);
        return null; // Signals to the caller to use mock fallback
      }
      throw new Error(data.error || `Market API error: ${response.status}`);
    }
    isDemoMode = false;
    return data;
  } catch (err: any) {
    if (err.message?.includes('FINNHUB_API_KEY') && symbolHint && MOCK_DATA[symbolHint]) {
      isDemoMode = true;
      return null;
    }
    throw err;
  }
}

export async function getQuote(symbol: string): Promise<MarketQuote> {
  const data = await fetchWithError(`${API_BASE}/quote?symbol=${symbol}`, symbol);
  if (data === null) return MOCK_DATA[symbol]?.quote || MOCK_DATA['NVDA'].quote;
  return data;
}

export async function getMarketNews(category: string = 'general'): Promise<NewsItem[]> {
  const data = await fetchWithError(`${API_BASE}/news?category=${category}`);
  if (data === null) return MOCK_DATA['NVDA'].news;
  return data;
}

export async function getCompanyNews(symbol: string): Promise<NewsItem[]> {
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // last 7 days
  const data = await fetchWithError(`${API_BASE}/company-news?symbol=${symbol}&from=${from}&to=${to}`, symbol);
  if (data === null) return MOCK_DATA[symbol]?.news || [];
  return data;
}

export async function searchSymbols(query: string): Promise<SearchResult[]> {
  const data = await fetchWithError(`${API_BASE}/search?q=${query}`);
  if (data === null) return [{ symbol: 'NVDA', description: 'NVIDIA Corp', displaySymbol: 'NVDA', type: 'Common Stock' }];
  return data.result || [];
}

export async function getCompanyProfile(symbol: string): Promise<CompanyProfile> {
  const data = await fetchWithError(`${API_BASE}/stock/profile2?symbol=${symbol}`, symbol);
  if (data === null) return MOCK_DATA[symbol]?.profile || MOCK_DATA['NVDA'].profile;
  return data;
}

export async function getCandles(symbol: string, resolution: string = 'D', from?: number, to?: number) {
  const currentTo = to || Math.floor(Date.now() / 1000);
  const currentFrom = from || (currentTo - 30 * 24 * 60 * 60); // Default to 30 days
  const data = await fetchWithError(`${API_BASE}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${currentFrom}&to=${currentTo}`, symbol);
  
  if (data === null) {
    // Generate some random candle data for demo
    const count = resolution === '5' ? 20 : (resolution === '30' ? 50 : 100);
    const times = [];
    const prices = [];
    const startPrice = MOCK_DATA[symbol]?.quote?.pc || 100;
    
    for (let i = 0; i < count; i++) {
      times.push(currentFrom + (i * (currentTo - currentFrom) / count));
      prices.push(startPrice + Math.sin(i * 0.2) * 10 + (Math.random() - 0.5) * 5);
    }
    return { t: times, c: prices };
  }
  return data;
}
