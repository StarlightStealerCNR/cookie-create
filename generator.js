/**
 * generateImages — image generation via Hugging Face Inference API.
 *
 * Model: timbrooks/instruct-pix2pix
 *   - Accepts a reference image + a text instruction.
 *   - Transforms the image according to the instruction.
 *   - Free tier on Hugging Face Inference API.
 *
 * @param {object} options
 * @param {Buffer} options.image   - The reference image as a raw Buffer.
 * @param {string} options.prompt  - The user's text description of the desired design.
 * @param {string} options.mode    - How to interpret the image: 'shape' | 'artstyle' | 'both'
 * @param {number} options.count   - Number of images to generate (1–5).
 * @returns {Promise<string[]>}    - Array of base64-encoded PNG strings (no data URI prefix).
 */
async function generateImages({ image, prompt, mode, count }) {
  const HF_API_TOKEN = process.env.HF_API_TOKEN;
  if (!HF_API_TOKEN) {
    throw new Error('HF_API_TOKEN is not set. Add it to your environment variables.');
  }

  const MODEL = 'timbrooks/instruct-pix2pix';
  const API_URL = `https://api-inference.huggingface.co/models/${MODEL}`;

  // ── Build mode-specific instruction prefix ──────────────────────────────
  const prefixes = {
    shape:    'Transform this cookie, keeping its exact outline and shape. New design: ',
    artstyle: 'Redraw this cookie in the same hand-drawn art style and line weight. New design: ',
    both:     'Transform this cookie, keeping its exact outline and shape, drawn in the same hand-drawn art style and line weight. New design: ',
  };
  const instruction = (prefixes[mode] || prefixes.both) + prompt;

  // ── Convert Buffer to base64 for the API payload ─────────────────────────
  const imageBase64 = image.toString('base64');

  // ── Fire `count` sequential requests (free tier: one image per call) ─────
  const results = [];

  for (let i = 0; i < count; i++) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_TOKEN}`,
        'Content-Type': 'application/json',
        'x-wait-for-model': 'true',   // wait if model is loading, avoids 503
      },
      body: JSON.stringify({
        inputs: imageBase64,
        parameters: {
          prompt: instruction,
          image_guidance_scale: 1.5,  // how closely to follow the reference image
          guidance_scale: 7.5,        // how closely to follow the text instruction
          num_inference_steps: 20,    // lower = faster, higher = better quality
        },
      }),
    });

    // ── Handle model-loading (503) ──
    if (response.status === 503) {
      const body = await response.json().catch(() => ({}));
      const waitTime = body.estimated_time ? `~${Math.ceil(body.estimated_time)}s` : 'a moment';
      throw new Error(`The model is currently loading (${waitTime}). Please try again shortly.`);
    }

    // ── Handle rate limit from HF ──
    if (response.status === 429) {
      throw new Error('Hugging Face rate limit reached. Please wait a moment and try again.');
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Hugging Face API error (${response.status}).`);
    }

    // ── Response is raw image bytes (not JSON) ────────────────────────────
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    results.push(base64);
  }

  return results;
}

module.exports = generateImages;
