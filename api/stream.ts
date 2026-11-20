import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const SECRET = 'XGRlBW9FXlekgbPrRHuSiA';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { trackId, token } = req.query;

  if (!trackId || typeof trackId !== 'string') {
    return res.status(400).json({ error: 'Missing trackId parameter' });
  }

  const authToken = (typeof token === 'string' && token) || req.headers.authorization?.replace(/^OAuth\s+/, '') || '';
  if (!authToken) {
    return res.status(401).json({ error: 'Missing OAuth token' });
  }

  try {
    // 1. Fetch download-info
    const infoResp = await fetch(`https://api.music.yandex.net/tracks/${trackId}/download-info`, {
      headers: {
        Authorization: `OAuth ${authToken}`,
        'X-Yandex-Music-Client': 'YandexMusicAndroid/24022432',
        'User-Agent': 'Yandex-Music-API',
      },
    });

    if (!infoResp.ok) {
      return res.status(infoResp.status).json({ error: 'Failed to fetch download-info from Yandex' });
    }

    const infoData = await infoResp.json();
    const results = infoData.result;
    if (!Array.isArray(results) || results.length === 0) {
      return res.status(404).json({ error: 'No download info found' });
    }

    // Pick best 320kbps MP3
    const best = results
      .filter((r: any) => r.codec === 'mp3')
      .sort((a: any, b: any) => (b.bitrateInKbps || 0) - (a.bitrateInKbps || 0))[0] || results[0];

    const downloadInfoUrl = best.downloadInfoUrl || best.download_info_url;
    if (!downloadInfoUrl) {
      return res.status(500).json({ error: 'downloadInfoUrl missing' });
    }

    // 2. Fetch parameters from downloadInfoUrl
    const jsonUrl = downloadInfoUrl.includes('?') ? `${downloadInfoUrl}&format=json` : `${downloadInfoUrl}?format=json`;
    const jsonResp = await fetch(jsonUrl);
    if (!jsonResp.ok) {
      return res.status(500).json({ error: 'Failed to fetch download XML/JSON' });
    }

    const json = await jsonResp.json();
    const { host, path, ts } = json;
    if (!host || !path || !ts) {
      return res.status(500).json({ error: 'Incomplete download parameters' });
    }

    // 3. MD5 Sign
    const pathClean = path.replace(/^\//, '');
    const signStr = `${SECRET}${pathClean}${ts}`;
    const sign = crypto.createHash('md5').update(signStr).digest('hex');
    const directMp3Url = `https://${host}/get-mp3/${sign}/${ts}${path}`;

    // 4. Redirect directly to the signed audio file
    res.setHeader('Location', directMp3Url);
    return res.status(302).end();
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal proxy error' });
  }
}
