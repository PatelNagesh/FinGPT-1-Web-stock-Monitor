import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Trash2, Filter, Check } from 'lucide-react';
import { chatWithFinancialAI } from '../services/geminiService';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface ForecasterProps {
  symbol?: string;
  watchlist?: string[];
}

export function Forecaster({ symbol, watchlist = [] }: ForecasterProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: `Hello! I am FinGPT AI, your specialized financial analyst. ${symbol ? `I see we are looking at ${symbol}.` : ''} How can I help you analyze the markets today?` }
  ]);
  const [focusedStocks, setFocusedStocks] = useState<string[]>(symbol ? [symbol] : []);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Sync focused stocks when dashboard symbol changes if nothing is selected or just default behavior
  useEffect(() => {
    if (symbol && !focusedStocks.includes(symbol) && focusedStocks.length === 0) {
      setFocusedStocks([symbol]);
    }
  }, [symbol]);

  const toggleFocus = (s: string) => {
    setFocusedStocks(prev => 
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const clearChat = () => {
    setMessages([
      { role: 'model', content: "Chat history cleared. I'm ready for new analysis. What's on your mind?" }
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      // Pass the focused stocks as context
      const context = focusedStocks.length > 0 
        ? `Focused symbols: ${focusedStocks.join(', ')}` 
        : symbol;

      const stream = await chatWithFinancialAI(userMsg, history, context);
      let fullResponse = '';
      
      setMessages(prev => [...prev, { role: 'model', content: '' }]);

      for await (const chunk of stream) {
        fullResponse += chunk.text;
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1].content = fullResponse;
          return next;
        });
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Sentiment Engine v4</h3>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={clearChat}
              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
              title="Clear History"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
            <div className="h-4 w-px bg-slate-200"></div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active</span>
            </div>
          </div>
        </div>

        {watchlist.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <div className="flex items-center gap-1.5 mr-2">
              <Filter className="w-3 h-3 text-slate-400" />
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AI Focus:</span>
            </div>
            {watchlist.map(s => (
              <button
                key={s}
                onClick={() => toggleFocus(s)}
                className={cn(
                  "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all border shrink-0 flex items-center gap-1",
                  focusedStocks.includes(s)
                    ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm"
                    : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"
                )}
              >
                {focusedStocks.includes(s) && <Check className="w-2.5 h-2.5" />}
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#fcfdfe]">
        <AnimatePresence>
          {messages.map((m, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-4 max-w-[85%]",
                m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm border",
                m.role === 'model' ? "bg-blue-600 text-white border-blue-700" : "bg-slate-900 border-slate-800 text-slate-100"
              )}>
                {m.role === 'model' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className={cn(
                "p-4 rounded-xl text-sm leading-relaxed shadow-sm border",
                m.role === 'model' ? "bg-white text-slate-700 border-slate-100 rounded-tl-none" : "bg-slate-50 text-slate-800 border-slate-200 rounded-tr-none"
              )}>
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isTyping && !messages[messages.length-1].content && (
          <div className="flex gap-4">
             <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-white p-4 rounded-xl animate-pulse text-slate-400 text-sm border border-slate-100 shadow-sm">Thinking...</div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-slate-100 px-6">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={focusedStocks.length > 0 ? `Analyze ${focusedStocks.join(', ')}...` : "Describe a market scenario..."}
            className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 outline-none text-sm text-slate-700 py-3.5 pl-4 pr-12 rounded-xl font-sans placeholder:text-slate-400 transition-all font-medium"
          />
          <button 
            type="submit"
            disabled={isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
