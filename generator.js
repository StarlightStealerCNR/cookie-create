/**
 * generateImages — shared image generation module.
 *
 * @param {object} options
 * @param {Buffer} options.image          - The reference image as a raw Buffer.
 * @param {string} options.prompt         - The user's text description of the desired design.
 * @param {string} options.mode           - How to interpret the image: 'shape' | 'artstyle' | 'both'
 * @param {number} options.count          - Number of images to generate (2–8).
 * @returns {Promise<string[]>}           - Array of base64-encoded PNG strings (no data URI prefix).
 *
 * Operating modes:
 *   shape    — Model uses the reference image's outline/shape as a hard constraint.
 *   artstyle — Model matches the drawing style, line weight, and colour palette of the reference.
 *   both     — Both shape and artstyle constraints are applied simultaneously.
 *
 * Sub-Task 6 will replace the stub below with a real Hugging Face Inference API call.
 */
async function generateImages({ image, prompt, mode, count }) {
  // --- STUB: returns `count` copies of a 1×1 transparent PNG for UI testing ---
  // TODO (Sub-Task 6): replace with real Hugging Face img2img call.
  const PLACEHOLDER_PNG =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  return Array(count).fill(PLACEHOLDER_PNG);
}

module.exports = generateImages;
