import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const DIST_DIR = path.join(__dirname, 'dist');
const SECRET = 'XGRlBW9FXlekgbPrRHuSiA';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

const server = http.createServer(async (req, res) => {
  // 1. Enable Global CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Yandex-Music-Client, Range');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // 2. Stream Audio Endpoint (/api/stream)
  if (pathname === '/api/stream') {
    const trackId = reqUrl.searchParams.get('trackId');
    const token = reqUrl.searchParams.get('token') || req.headers.authorization?.replace(/^OAuth\s+/, '');

    if (!trackId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing trackId parameter' }));
      return;
    }
    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing OAuth token' }));
      return;
    }

    try {
      const infoResp = await fetch(`https://api.music.yandex.net/tracks/${trackId}/download-info`, {
        headers: {
          Authorization: `OAuth ${token}`,
          'X-Yandex-Music-Client': 'YandexMusicAndroid/24022432',
          'User-Agent': 'Yandex-Music-API',
        },
      });

      if (!infoResp.ok) {
        res.writeHead(infoResp.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch download-info from Yandex' }));
        return;
      }

      const infoData = await infoResp.json();
      const results = infoData.result;
      if (!Array.isArray(results) || results.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No download info found' }));
        return;
      }

      const best = results
        .filter((r) => r.codec === 'mp3')
        .sort((a, b) => (b.bitrateInKbps || 0) - (a.bitrateInKbps || 0))[0] || results[0];

      const downloadInfoUrl = best.downloadInfoUrl || best.download_info_url;
      const jsonUrl = downloadInfoUrl.includes('?') ? `${downloadInfoUrl}&format=json` : `${downloadInfoUrl}?format=json`;
      const jsonResp = await fetch(jsonUrl);
      const json = await jsonResp.json();
      const { host, path: audioPath, ts } = json;

      if (!host || !audioPath || !ts) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Incomplete download parameters' }));
        return;
      }

      const pathClean = audioPath.replace(/^\//, '');
      const sign = crypto.createHash('md5').update(`${SECRET}${pathClean}${ts}`).digest('hex');
      const directUrl = `https://${host}/get-mp3/${sign}/${ts}${audioPath}`;

      res.writeHead(302, {
        Location: directUrl,
        'Access-Control-Allow-Origin': '*',
      });
      res.end();
      return;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
      return;
    }
  }

  // 3. Yandex Music API Proxy (/api/ym/*)
  if (pathname.startsWith('/api/ym/')) {
    const subpath = pathname.replace(/^\/api\/ym\//, '');
    const upstreamUrl = `https://api.music.yandex.net/${subpath}${reqUrl.search}`;

    const headers = {
      'User-Agent': req.headers['user-agent'] || 'Yandex-Music-API',
      'X-Yandex-Music-Client': req.headers['x-yandex-music-client'] || 'YandexMusicAndroid/24022432',
    };
    if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

    try {
      let bodyData;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        bodyData = await new Promise((resolve) => {
          const chunks = [];
          req.on('data', (c) => chunks.push(c));
          req.on('end', () => resolve(Buffer.concat(chunks)));
        });
      }

      const upstreamRes = await fetch(upstreamUrl, {
        method: req.method,
        headers,
        body: bodyData,
      });

      const responseBuffer = await upstreamRes.arrayBuffer();
      res.writeHead(upstreamRes.status, {
        'Content-Type': upstreamRes.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(Buffer.from(responseBuffer));
      return;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
      return;
    }
  }

  // 4. Static Files & SPA Fallback
  let filePath = path.join(DIST_DIR, pathname);

  // Security: prevent path traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback: serve index.html for all non-file routes
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    };

    // Service Worker must never be cached aggressively
    if (filePath.endsWith('sw.js')) {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Service-Worker-Allowed'] = '/';
    } else if (filePath.endsWith('manifest.json')) {
      headers['Cache-Control'] = 'public, max-age=0, must-revalidate';
      headers['Content-Type'] = 'application/manifest+json';
    } else if (ext === '.js' || ext === '.css' || ext === '.png' || ext === '.woff2') {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      res.writeHead(200, headers);
      res.end(content);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[YM PWA Server] Listening on http://0.0.0.0:${PORT}`);
});
