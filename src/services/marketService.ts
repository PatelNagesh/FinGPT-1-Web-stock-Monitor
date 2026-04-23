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

async function fetchWithError(url: string) {
  const response = await fetch(url);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || `Market API error: ${response.status}`);
  }
  return data;
}

export async function getQuote(symbol: string): Promise<MarketQuote> {
  return fetchWithError(`${API_BASE}/quote?symbol=${symbol}`);
}

export async function getMarketNews(category: string = 'general'): Promise<NewsItem[]> {
  return fetchWithError(`${API_BASE}/news?category=${category}`);
}

export async function getCompanyNews(symbol: string): Promise<NewsItem[]> {
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // last 7 days
  return fetchWithError(`${API_BASE}/company-news?symbol=${symbol}&from=${from}&to=${to}`);
}

export async function searchSymbols(query: string): Promise<SearchResult[]> {
  const result = await fetchWithError(`${API_BASE}/search?q=${query}`);
  return result.result || [];
}

export async function getCandles(symbol: string, resolution: string = 'D', from?: number, to?: number) {
  const currentTo = to || Math.floor(Date.now() / 1000);
  const currentFrom = from || (currentTo - 30 * 24 * 60 * 60); // Default to 30 days
  return fetchWithError(`${API_BASE}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${currentFrom}&to=${currentTo}`);
}
