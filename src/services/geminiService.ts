import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

export interface PricePrediction {
  targetPrice: number;
  timeframe: string;
  confidence: number; // 0 to 1
  sentiment: string;
  reasoning: string;
  risks: string[];
}

export async function predictPrice(
  symbol: string, 
  currentQuote: any, 
  news: any[]
): Promise<PricePrediction> {
  const newsContext = news.slice(0, 5).map(n => `- ${n.headline}: ${n.summary}`).join('\n');
  
  const prompt = `You are a professional financial analyst. Based on the following real-time market data and recent news for ${symbol}, provide a price prediction for the next 7 days.
  
  Current Data for ${symbol}:
  - Current Price: ${currentQuote.c}
  - Change: ${currentQuote.d} (${currentQuote.dp}%)
  - High today: ${currentQuote.h}
  - Low today: ${currentQuote.l}
  - Previous Close: ${currentQuote.pc}
  
  Recent News:
  ${newsContext}
  
  Return a JSON object with:
  - targetPrice: number (expected price in 7 days)
  - timeframe: string (e.g. "7 days")
  - confidence: number (0 to 1)
  - sentiment: string ("bullish", "bearish", or "neutral")
  - reasoning: string (detailed analysis)
  - risks: string[] (potential downside risks)
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    }
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error('Failed to parse Gemini prediction', e);
    throw new Error('AI analysis failed. Please try again later.');
  }
}

export async function chatWithFinancialAI(
  message: string, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  symbolContext?: string
) {
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: `You are FinGPT AI, a specialized financial expert. ${symbolContext ? `Current focus: ${symbolContext}.` : ''} You provide objective, data-driven financial analysis. You are inspired by the open-source FinGPT framework. Always include reasoning based on market dynamics.`
    },
    history: history.slice(0, -1) // Correct history handling
  });

  const stream = await chat.sendMessageStream({ message });
  return stream;
}
