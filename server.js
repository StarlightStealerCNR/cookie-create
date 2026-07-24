const express = require('express');
const path    = require('path');
const { formidable } = require('formidable');
const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');
const generateImages = require('./generator');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Startup environment check ──────────────────────────────────────────────
const REQUIRED_ENV = ['HF_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`[startup] Missing environment variables: ${missing.join(', ')}`);
} else {
  console.log('[startup] All required environment variables are present.');
}

// ── Static files ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── POST /api/generate ─────────────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  // --- Rate limiting ---
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  try {
    const ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '15 m'),
      analytics: false,
    });
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return res.status(429).json({
        error: 'Too many requests — please wait 15 minutes before trying again.',
      });
    }
  } catch (err) {
    console.error('[rate-limit] Failed to initialise:', err.message);
    // Allow the request through if rate limiting is unavailable
  }

  // --- Parse multipart form data ---
  const form = formidable({ maxFileSize: 10 * 1024 * 1024 }); // 10 MB max

  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch (err) {
    return res.status(400).json({ error: 'Failed to parse form data.' });
  }

  const prompt = Array.isArray(fields.prompt) ? fields.prompt[0] : fields.prompt;
  const mode   = Array.isArray(fields.mode)   ? fields.mode[0]   : fields.mode;
  const count  = Math.min(5, Math.max(1, parseInt(
    Array.isArray(fields.count) ? fields.count[0] : fields.count, 10
  ) || 4));

  const imageFile = files.image?.[0] ?? files.image;

  // --- Server-side validation ---
  if (!imageFile) {
    return res.status(400).json({ error: 'Please upload a reference image.' });
  }
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'Please enter a description.' });
  }

  // --- Read image into Buffer ---
  const fs = require('fs');
  const imageBuffer = fs.readFileSync(imageFile.filepath);

  // --- Generate ---
  try {
    const images = await generateImages({
      image: imageBuffer,
      prompt: prompt.trim(),
      mode,
      count,
    });
    return res.status(200).json({ images });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Image generation failed.' });
  }
});

// ── Catch-all: serve index.html for any unmatched route ───────────────────
app.get('*path', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CookieCreate running on http://localhost:${PORT}`);
});
