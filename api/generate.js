const formidable = require("formidable");
const generateImages = require("../generator");

// ── Rate limiting ──────────────────────────────────────────────────────────
// In-memory store: Map<ip, { count: number, windowStart: number }>
// Resets on cold starts — intentional; this is a soft abuse deterrent.
const RATE_LIMIT_MAX = 10; // requests per window per IP
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes in ms
const ipStore = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = ipStore.get(ip);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW) {
    // First request or window has expired — start a fresh window
    ipStore.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count += 1;
  return false;
}
// ──────────────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- Rate limiting ---
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: "Too many requests — please wait 15 minutes before trying again.",
    });
  }

  // --- Parse multipart form data ---
  const form = formidable({ maxFileSize: 10 * 1024 * 1024 }); // 10 MB max

  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch (err) {
    return res.status(400).json({ error: "Failed to parse form data." });
  }

  const prompt = Array.isArray(fields.prompt)
    ? fields.prompt[0]
    : fields.prompt;
  const mode = Array.isArray(fields.mode) ? fields.mode[0] : fields.mode;
  const count = Math.min(
    8,
    Math.max(
      1,
      parseInt(
        Array.isArray(fields.count) ? fields.count[0] : fields.count,
        10,
      ) || 4,
    ),
  );

  const imageFile = files.image?.[0] ?? files.image;

  // --- Server-side validation ---
  if (!imageFile) {
    return res.status(400).json({ error: "Please upload a reference image." });
  }
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "Please enter a description." });
  }

  // --- Read image into Buffer ---
  const fs = require("fs");
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
    return res
      .status(500)
      .json({ error: err.message || "Image generation failed." });
  }
};
