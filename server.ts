import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load environment variables from .env
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy for Finnhub to hide secrets from the browser
  app.use('/api/market', async (req, res) => {
    // req.path is the part after '/api/market'
    // For example, if request is /api/market/quote, req.path is /quote
    const apiPath = req.path.replace(/^\//, ''); 
    
    if (!apiPath) {
      return res.status(400).json({ error: 'Endpoint path is required' });
    }

    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (value) queryParams.append(key, String(value));
    }
    
    // Look up key dynamically
    const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || process.env.VITE_FINNHUB_API_KEY;

    if (!FINNHUB_API_KEY) {
      console.warn('FINNHUB_API_KEY is missing from environment');
      return res.status(401).json({ 
        error: 'FINNHUB_API_KEY is missing. Please configure it in the Secrets panel.' 
      });
    }

    queryParams.append('token', FINNHUB_API_KEY);
    const url = `https://finnhub.io/api/v1/${apiPath}?${queryParams.toString()}`;

    try {
      const response = await fetch(url);
      
      // Pass through the content type if possible
      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error(`Finnhub proxy error for ${apiPath}:`, error);
      res.status(500).json({ error: 'Failed to fetch from market provider' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FinGPT Terminal Server running on http://localhost:${PORT}`);
  });
}

startServer();
