import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy for Finnhub to hide secrets from the browser
  app.get('/api/market/*', async (req, res) => {
    const apiPath = req.params[0] || '';
    const queryParams = new URLSearchParams(req.query as any);
    
    // Look up key dynamically in case environment changes
    const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || process.env.VITE_FINNHUB_API_KEY;

    if (!FINNHUB_API_KEY) {
      return res.status(500).json({ 
        error: 'FINNHUB_API_KEY is missing. Please configure it in the Secrets panel as FINNHUB_API_KEY.' 
      });
    }

    queryParams.append('token', FINNHUB_API_KEY);
    const url = `https://finnhub.io/api/v1/${apiPath}?${queryParams.toString()}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error('Finnhub proxy error:', error);
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
