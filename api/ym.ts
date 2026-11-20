import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Yandex-Music-Client, Range');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract path and remaining query params
  const { path, ...restQuery } = req.query;
  const pathStr = Array.isArray(path) ? path.join('/') : (path || '');

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(restQuery)) {
    if (v !== undefined && v !== null) {
      if (Array.isArray(v)) {
        v.forEach((val) => qs.append(k, String(val)));
      } else {
        qs.append(k, String(v));
      }
    }
  }
  const queryString = qs.toString() ? `?${qs.toString()}` : '';
  const targetUrl = `https://api.music.yandex.net/${pathStr}${queryString}`;

  // Client IP handling for Yandex regional licensing
  const rawClientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.headers['x-real-ip'] as string);
  const clientIp = rawClientIp && !rawClientIp.startsWith('10.') && !rawClientIp.startsWith('192.168.') ? rawClientIp : '5.255.255.5';

  const headers: Record<string, string> = {
    'User-Agent': (req.headers['user-agent'] as string) || 'Yandex-Music-API',
    'X-Yandex-Music-Client': (req.headers['x-yandex-music-client'] as string) || 'YandexMusicAndroid/24022432',
    'X-Forwarded-For': `${clientIp}, 5.255.255.5`,
    'X-Real-IP': clientIp,
  };

  if (req.headers.authorization) {
    headers['Authorization'] = req.headers.authorization as string;
  }
  if (req.headers['content-type']) {
    headers['Content-Type'] = req.headers['content-type'] as string;
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' && req.body
        ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
        : undefined,
    });

    const data = await upstreamRes.text();
    res.status(upstreamRes.status);
    const contentType = upstreamRes.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    return res.send(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Upstream request failed' });
  }
}
