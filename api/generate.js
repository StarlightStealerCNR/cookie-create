const { formidable } = require("formidable");
const generateImages = require("../generator");
const { Ratelimit } = require("@upstash/ratelimit");
const { Redis } = require("@upstash/redis");

// ── Rate limiting (Upstash Redis — persistent, cross-instance) ────────────
// Primary layer: Vercel Firewall (configured in Vercel dashboard).
// Secondary layer: Upstash sliding-window counter, survives cold starts.
// Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in env.
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "15 m"), // 10 requests per 15 minutes per IP
  analytics: false,
});
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

  const { success } = await ratelimit.limit(ip);
  if (!success) {
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
    6,
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
