/**
 * generateImages — image generation via fal.ai
 *
 * Model: fal-ai/image-to-image (Stable Diffusion img2img)
 *   - Accepts a reference image + a text prompt.
 *   - Truly async — fal.ai queues the job and returns when done,
 *     without holding an HTTP connection open for the full duration.
 *   - Works within Vercel Hobby plan's 10s function timeout because
 *     fal.ai handles the long-running work server-side.
 *
 * @param {object} options
 * @param {Buffer} options.image   - The reference image as a raw Buffer.
 * @param {string} options.prompt  - The user's text description of the desired design.
 * @param {string} options.mode    - How to interpret the image: 'shape' | 'artstyle' | 'both'
 * @param {number} options.count   - Number of images to generate (1–5).
 * @returns {Promise<string[]>}    - Array of base64-encoded PNG strings (no data URI prefix).
 */
const { fal } = require('@fal-ai/client');

async function generateImages({ image, prompt, mode, count }) {
  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    throw new Error('FAL_KEY is not set. Add it to your environment variables.');
  }

  // Configure fal client with API key
  fal.config({ credentials: FAL_KEY });

  // ── Build mode-specific prompt prefix ───────────────────────────────────
  const prefixes = {
    shape:    'Transform this cookie, keeping its exact outline and shape. New design: ',
    artstyle: 'Redraw this cookie in the same hand-drawn art style and line weight. New design: ',
    both:     'Transform this cookie, keeping its exact outline and shape, drawn in the same hand-drawn art style and line weight. New design: ',
  };
  const fullPrompt = (prefixes[mode] || prefixes.both) + prompt;

  // ── Convert Buffer to base64 data URI for fal.ai upload ─────────────────
  const imageBase64 = `data:image/png;base64,${image.toString('base64')}`;

  // ── Upload reference image to fal.ai storage (required for img2img) ─────
  let imageUrl;
  try {
    imageUrl = await fal.storage.upload(
      new Blob([image], { type: 'image/png' })
    );
  } catch (err) {
    throw new Error('Failed to upload reference image. Please try again.');
  }

  // ── Submit `count` jobs and collect results ──────────────────────────────
  const results = [];

  for (let i = 0; i < count; i++) {
    let result;
    try {
      result = await fal.subscribe('fal-ai/image-to-image', {
        input: {
          prompt: fullPrompt,
          image_url: imageUrl,
          strength: 0.75,          // how much to transform vs. preserve (0=no change, 1=ignore original)
          num_inference_steps: 28,
          guidance_scale: 7.5,
          num_images: 1,
        },
        logs: false,
      });
    } catch (err) {
      throw new Error(err.message || 'fal.ai generation failed. Please try again.');
    }

    // ── Fetch the output image and convert to base64 ─────────────────────
    const outputUrl = result?.data?.images?.[0]?.url;
    if (!outputUrl) {
      throw new Error('No image returned from fal.ai. Please try again.');
    }

    const imgResponse = await fetch(outputUrl);
    if (!imgResponse.ok) {
      throw new Error('Failed to retrieve generated image. Please try again.');
    }

    const arrayBuffer = await imgResponse.arrayBuffer();
    results.push(Buffer.from(arrayBuffer).toString('base64'));
  }

  return results;
}

module.exports = generateImages;
