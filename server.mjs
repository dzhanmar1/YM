import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Force IPv4 lookup first across all Node.js operations
dns.setDefaultResultOrder('ipv4first');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const DIST_DIR = path.join(__dirname, 'dist');
const SECRET = 'XGRlBW9FXlekgbPrRHuSiA';
const CLIENT_VERSION = 'YandexMusicAndroid/24023621';

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

// Robust IPv4 HTTPS GET helper for JSON APIs
function getJsonIPv4(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      parsed,
      {
        method: 'GET',
        family: 4, // STRICTLY IPv4: avoids Yandex Antirobot captcha on dynamic IPv6 ranges
        headers: {
          'User-Agent': CLIENT_VERSION,
          'X-Yandex-Music-Client': CLIENT_VERSION,
          Accept: 'application/json',
          ...extraHeaders,
        },
        timeout: 12000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({ status: res.statusCode || 200, data });
          } catch {
            resolve({ status: res.statusCode || 200, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout to ' + url));
    });
    req.end();
  });
}

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

  // 2. Health & Diagnostics Endpoint (/api/health)
  if (pathname === '/api/health') {
    try {
      const ymCheck = await getJsonIPv4('https://api.music.yandex.net/account/status');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          {
            status: 'ok',
            node: process.version,
            dns_order: dns.getDefaultResultOrder(),
            ym_api_status: ymCheck.status,
            ym_region: ymCheck.data?.result?.account?.regionCode || 'unknown',
          },
          null,
          2
        )
      );
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', error: String(err) }));
    }
    return;
  }

  // 3. Direct Audio Stream Resolver (/api/stream)
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
      const infoResp = await getJsonIPv4(`https://api.music.yandex.net/tracks/${trackId}/download-info`, {
        Authorization: `OAuth ${token}`,
      });

      if (infoResp.status !== 200 || !infoResp.data?.result) {
        res.writeHead(infoResp.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch download-info from Yandex', details: infoResp.raw || infoResp.data }));
        return;
      }

      const results = infoResp.data.result;
      if (!Array.isArray(results) || results.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No download info found' }));
        return;
      }

      const best =
        results
          .filter((r) => r.codec === 'mp3')
          .sort((a, b) => (b.bitrateInKbps || 0) - (a.bitrateInKbps || 0))[0] || results[0];

      const downloadInfoUrl = best.downloadInfoUrl || best.download_info_url;
      const jsonUrl = downloadInfoUrl.includes('?') ? `${downloadInfoUrl}&format=json` : `${downloadInfoUrl}?format=json`;
      const jsonResp = await getJsonIPv4(jsonUrl);
      const { host, path: audioPath, ts } = jsonResp.data || {};

      if (!host || !audioPath || !ts) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Incomplete download parameters', details: jsonResp.raw || jsonResp.data }));
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

  // 4. Yandex Music API Streaming Proxy (/api/ym/*)
  if (pathname.startsWith('/api/ym/')) {
    const subpath = pathname.replace(/^\/api\/ym\//, '');
    const upstreamUrl = `https://api.music.yandex.net/${subpath}${reqUrl.search}`;
    const parsedUpstream = new URL(upstreamUrl);

    // Filter headers: NEVER forward Origin or Referer to Yandex (causes 403 Forbidden!)
    const upstreamHeaders = {
      Host: parsedUpstream.host,
      'User-Agent': CLIENT_VERSION,
      'X-Yandex-Music-Client': CLIENT_VERSION,
      Accept: 'application/json',
    };

    if (req.headers.authorization) upstreamHeaders['Authorization'] = req.headers.authorization;
    if (req.headers['content-type']) upstreamHeaders['Content-Type'] = req.headers['content-type'];
    if (req.headers.range) upstreamHeaders['Range'] = req.headers.range;

    const proxyReq = https.request(
      parsedUpstream,
      {
        method: req.method,
        family: 4, // Force IPv4: Yandex antirobot flags/blocks residential IPv6 prefixes
        headers: upstreamHeaders,
        timeout: 15000,
      },
      (upstreamRes) => {
        const responseHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Yandex-Music-Client, Range',
        };
        if (upstreamRes.headers['content-type']) responseHeaders['Content-Type'] = upstreamRes.headers['content-type'];
        if (upstreamRes.headers['content-length']) responseHeaders['Content-Length'] = upstreamRes.headers['content-length'];
        if (upstreamRes.headers['content-range']) responseHeaders['Content-Range'] = upstreamRes.headers['content-range'];

        res.writeHead(upstreamRes.statusCode || 200, responseHeaders);
        upstreamRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      console.error(`[Proxy Error] ${req.method} ${upstreamUrl}:`, err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Proxy request failed: ' + err.message }));
      }
    });

    req.pipe(proxyReq);
    return;
  }

  // 5. Static Files & SPA Fallback
  let filePath = path.join(DIST_DIR, pathname);

  // Security: prevent path traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    };

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
  console.log(`[YM PWA Server] Listening on http://0.0.0.0:${PORT} (IPv4 strict mode active)`);
});
