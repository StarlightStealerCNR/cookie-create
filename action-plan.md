# Cookie Creator — Action Plan

## High-Level Overview

Build a simple single-page web app that helps a small cookie business owner generate design ideas for custom cookies. The user uploads a single reference image, enters a text description, selects how many images to generate (2–8), and chooses — via a dropdown — how the tool should interpret the reference image: as a **shape reference** (cookie base mold), an **artstyle reference** (finished illustration), or **both at once**.

The app is **fully public** — no login required. The `/generate` endpoint is protected by a rate limiter to prevent abuse.

**Architecture:**

- **Frontend:** Vanilla HTML/CSS/JavaScript (no framework) — static files served directly by Vercel from the `public/` folder, responsive for both desktop and mobile.
- **Backend:** A single Vercel Serverless Function (`api/generate.js`) — handles rate limiting and proxies image generation requests to Hugging Face. No Express server needed.
- **Image Generation:** Hugging Face Inference API (free tier) — image-to-image model; the reference image and a mode-specific constructed prompt are sent per request.
- **Access Control:** Rate limiting via `@vercel/edge` or an in-function IP check on the `/api/generate` endpoint — no login, no sessions.
- **Deployment:** Vercel — connect GitHub repo, set `HF_API_TOKEN` in the Vercel dashboard, deploy.

**Key Design Decisions:**

- One upload slot. The dropdown menu (`Shape only` / `Artstyle only` / `Both`) controls how the reference image is interpreted, which in turn shapes the prompt sent to Hugging Face.
- No sessions, no database, no authentication — the function is entirely stateless; Vercel's serverless model is a natural fit.
- On mobile, the upload input triggers a native prompt offering the photo library, a file app, or the device camera directly — no extra code needed beyond correct `<input>` attributes.
- Generated images are displayed on-page and stay visible until the browser is refreshed; the user is responsible for downloading them.

**What is explicitly out of scope:**

- Per-user accounts or usage tracking.
- Mobile optimisation beyond responsive layout and camera integration.

---

## Sub-Tasks

---

### Sub-Task 1 — Project Scaffold & Vercel Structure

**Intent:**
Create the project folder structure for a Vercel deployment: static frontend files in `public/`, a single serverless function in `api/generate.js`, and a shared `generator.js` module. This is the foundation everything else builds on.

**Expected Outcomes:**

- Project has the correct layout for Vercel: `public/` for static assets, `api/` for serverless functions.
- `api/generate.js` exists as a stub that returns a placeholder JSON response when called.
- `generator.js` exists as a shared module with a stub `generateImages()` function.
- `vercel.json` config file is present to wire up routing correctly.
- `.env.local` file pattern is established for local development (not committed to source control).
- Running `vercel dev` locally serves the frontend and the API function together.

**Todo List:**

1. Run `npm init -y` to create `package.json`.
2. Install the Vercel CLI globally: `npm i -g vercel`.
3. Install the one runtime dependency needed by the function: `@vercel/node` is built-in; install `formidable` for multipart form parsing (replaces `multer` in a serverless context).
4. Create the folder structure: `public/` (static files), `api/` (serverless functions).
5. Create `api/generate.js` as a stub Vercel serverless function that exports a default handler, parses the incoming request, and returns `{ images: [] }` as a placeholder.
6. Create `generator.js` at the project root with a stub `generateImages({ image, prompt, mode, count })` function that returns an array of placeholder base64 strings.
7. Create `vercel.json` to configure routing: all `/api/*` requests go to the functions; all other requests serve from `public/`.
8. Create `.env.local` with `HF_API_TOKEN=` placeholder and `.gitignore` excluding `.env.local` and `node_modules/`.
9. Confirm `vercel dev` starts and `GET /` serves `public/index.html`.

**Relevant Context:**

- Vercel serverless functions do not use Express — each function in `api/` is a standalone handler exported as `export default function handler(req, res)`.
- `formidable` parses `multipart/form-data` in a serverless context; `multer` is Express-specific and not compatible here.
- The `generator.js` interface must stay stable: receives `{ image: Buffer, prompt: string, mode: string, count: number }` and returns `Promise<string[]>` (array of base64 PNG strings).
- `vercel dev` runs the full stack locally (static files + serverless functions) without needing a separate server.

**Status:** `[x] done`

---

### Sub-Task 2 — Frontend HTML & CSS Layout

**Intent:**
Build `public/index.html` and `public/style.css` matching the revised UI: one prominent upload box, a mode dropdown, a text description input, an image count selector, and a two-column output grid. The layout must be responsive for both desktop and mobile.

**Expected Outcomes:**

- One large upload box centred prominently on the page with "upload here" placeholder text/graphic.
- When an image is selected, it fills the upload box, replacing the placeholder.
- A dropdown below the upload box with three options: "Shape only", "Artstyle only", "Both".
- A `<textarea>` for the text description.
- A number selector for image count (2–8).
- A "Generate" button.
- A hidden inline error message container.
- A two-column CSS Grid output section below the controls (initially empty).
- On mobile (≤600px): upload box fills screen width, controls stack vertically, output grid collapses to one column.

**Todo List:**

1. Create `public/index.html` with `<meta name="viewport">` tag, a `<header>` with the app title, and a `<main>` containing: upload section, controls section, output section.
2. Create the upload box as a `<label>` wrapping a hidden `<input type="file" accept="image/*" capture="environment">` — the `capture="environment"` attribute triggers the native camera/library prompt on mobile.
3. Add a `<select id="mode">` with options: `shape` ("Shape only"), `artstyle` ("Artstyle only"), `both` ("Both").
4. Add a `<textarea id="prompt">` for the description.
5. Add an `<input type="number" min="2" max="8" value="4" id="count">` for image count.
6. Add a `<button id="generate-btn">Generate</button>` and a hidden `<div id="error-msg">`.
7. Create `public/style.css`: centred upload box at desktop size; two-column CSS Grid for output; output cells roughly half the size of the upload box; `@media (max-width: 600px)` breakpoint stacking everything vertically and collapsing the output to one column.
8. Create `public/app.js` with a `change` listener on the file input that previews the selected image inside the upload box using `URL.createObjectURL(file)`.

**Relevant Context:**

- `capture="environment"` on a mobile file input causes iOS and Android to offer: "Take Photo", "Photo Library", and "Browse" — no extra JavaScript needed.
- On desktop, `capture` is ignored and the standard file picker opens as normal.
- The output grid starts empty and is populated dynamically in Sub-Task 5.

**Status:** `[x] done`

---

### Sub-Task 3 — Rate Limiting

**Intent:**
Implement IP-based rate limiting inside `api/generate.js` so that no single IP address can flood the endpoint with requests. On Vercel, there is no shared server process, so rate limiting is handled with a lightweight in-memory store local to the function invocation — or via Vercel's built-in Edge Config / middleware if a stricter limit is needed.

**Expected Outcomes:**

- Each IP address is limited to a configurable number of `/api/generate` requests per time window (e.g. 10 requests per 15 minutes).
- Requests exceeding the limit receive a `429 Too Many Requests` response with a plain-English message.
- The static frontend files are unaffected.

**Todo List:**

1. Inside `api/generate.js`, read the requester's IP from the `x-forwarded-for` header (Vercel sets this automatically).
2. Implement a simple in-memory request counter: a `Map` keyed by IP storing `{ count, windowStart }`.
3. At the top of the handler, check if the IP has exceeded the limit within the current window; if so, return a `429` with a message.
4. Reset the counter for an IP once its window has expired.
5. In `public/app.js` (Sub-Task 5), handle the `429` response by displaying the rate limit message in `#error-msg`.

**Relevant Context:**

- Vercel serverless functions are stateless between invocations — the in-memory `Map` resets on cold starts. This is acceptable for a low-traffic personal tool; the limit is a soft abuse deterrent, not a hard billing control.
- If stricter limiting is needed later, Vercel's Edge Middleware (a `middleware.js` file at the project root) can enforce limits before the function is even invoked, using Vercel KV as the shared store.
- To swap to a password gate later: replace the rate limit check with a token/session check. No frontend changes beyond adding a login page.

**Status:** `[x] done`

---

### Sub-Task 4 — Frontend Validation Logic

**Intent:**
Implement client-side validation before any API call is made, showing appropriate inline error messages and blocking submission when required inputs are missing.

**Expected Outcomes:**

- Submitting with no image uploaded → inline error asking for an image; no request sent.
- Submitting with no description → inline error asking for a description; no request sent.
- Submitting with image + description + any mode selection → proceeds.
- Error messages clear at the start of each new submission attempt.

**Todo List:**

1. In `public/app.js`, attach a `submit` listener to the form (call `preventDefault()`).
2. Read values: uploaded file, prompt text, mode selection, image count.
3. Clear and hide `#error-msg` at the start of each submission.
4. Guard: if no file selected → show error in `#error-msg`, return.
5. Guard: if prompt is empty → show error in `#error-msg`, return.
6. If validation passes, proceed to the fetch call (Sub-Task 5).

**Relevant Context:**

- The mode dropdown always has a valid value (it has a default selection), so it does not need to be validated.
- The server-side `/generate` handler performs the same checks as a fallback, but the primary UX gatekeeping happens here in the browser.

**Status:** `[ ] pending`

---

### Sub-Task 5 — Frontend API Call & Output Display

**Intent:**
Wire up the frontend to send validated form data to `POST /generate` and render the returned images in the two-column output grid, with a loading state during generation.

**Expected Outcomes:**

- After validation passes, a loading indicator appears and the Generate button is disabled.
- A `fetch` POST request is sent with a `FormData` body: the image file, prompt, mode, and count.
- On success, the output grid is populated with the generated images.
- On a `429` response, a rate limit message is shown in `#error-msg`.
- On any other error, the inline error message is shown.
- The Generate button is re-enabled and the loading state clears regardless of outcome.

**Todo List:**

1. In `public/app.js`, after validation, build a `FormData` object with `image`, `prompt`, `mode`, and `count`.
2. Show loading state ("Generating…" and disable the Generate button).
3. `await fetch('/api/generate', { method: 'POST', body: formData })`.
4. If response status is `429`, display the rate limit message from the response in `#error-msg`.
5. Parse JSON response. On success (`response.images` array): clear the output grid and append one `<img>` per image using the base64 `src` strings.
6. On error (`response.error`): display the error in `#error-msg`.
7. In a `finally` block: re-enable the Generate button and clear the loading state.

**Relevant Context:**

- Do NOT manually set `Content-Type` when using `FormData` with `fetch` — the browser sets the correct `multipart/form-data` boundary automatically.
- The output grid retains images until the page is refreshed (no clear-on-submit).
- The stub from Sub-Task 1 returns placeholder base64 data so the full UI flow is testable before the Hugging Face call is wired in.

**Status:** `[ ] pending`

---

### Sub-Task 6 — Hugging Face Image Generation Integration

**Intent:**
Implement the real image generation logic in `generator.js` using the Hugging Face Inference API. The `mode` parameter controls how the prompt is constructed, directing the model to treat the reference image as a shape guide, a style guide, or both.

**Expected Outcomes:**

- `generateImages({ image, prompt, mode, count })` makes real calls to the Hugging Face img2img endpoint.
- The `mode` value shapes the instruction prepended to the user's prompt:
  - `shape`: instruct the model to preserve the cookie's outline/shape from the reference image and apply the described design within it.
  - `artstyle`: instruct the model to match the drawing style, line quality, and colour palette of the reference image.
  - `both`: combine both instructions.
- Returns an array of `count` base64-encoded PNG strings.
- Errors from Hugging Face (rate limit, invalid token, model unavailable) are caught and thrown as descriptive errors the server returns to the client.

**Todo List:**

1. Choose a suitable Hugging Face img2img model (e.g. `stabilityai/stable-diffusion-2-1`).
2. Add `HF_API_TOKEN` to `.env` (free Hugging Face account token).
3. In `generator.js`, use `fetch` to call `https://api-inference.huggingface.co/models/<model-id>` with:
   - `Authorization: Bearer <HF_API_TOKEN>` header.
   - JSON body with `inputs` (the base64-encoded reference image) and `parameters.prompt` (constructed from mode + user prompt).
4. Build the mode-specific prompt prefix:
   - `shape`: `"Cookie design using the exact outline and shape of the provided cookie base. Design: <user prompt>"`
   - `artstyle`: `"Cookie design drawn in the same art style, line weight, and colour palette as the reference image. Design: <user prompt>"`
   - `both`: `"Cookie design using the exact outline and shape of the reference cookie, drawn in the same art style and colour palette. Design: <user prompt>"`
5. Loop `count` times (Hugging Face free tier processes one image per call), collect responses, and return the array.
6. Add a `try/catch`; on error throw a new `Error` with a user-friendly message.

**Relevant Context:**

- Hugging Face free inference API returns the image as raw binary (not JSON); the response body must be read as `arrayBuffer()` and converted to base64.
- The free tier has a rate limit and queuing delay — generation of 8 images will take noticeably longer than 2.
- `image` arrives as a `Buffer` from `multer`; convert to base64 string with `image.toString('base64')` before sending.
- The `count` loop means `count` sequential API calls; acceptable for a low-volume tool but will be slow for large counts.

**Status:** `[ ] pending`

---

### Sub-Task 7 — README & Vercel Deployment Notes

**Intent:**
Write a README covering local setup and how to deploy to Vercel, so the app can be stood up from scratch by following the document.

**Expected Outcomes:**

- `README.md` covers: prerequisites, installation, all environment variables, running locally with `vercel dev`, and deploying to Vercel.
- Deployment section walks through connecting a GitHub repo to Vercel and setting `HF_API_TOKEN` in the Vercel dashboard.

**Todo List:**

1. Write `README.md` with sections: Overview, Prerequisites (`node >= 18`, Vercel CLI), Installation (`npm install`), Environment Variables (table with `HF_API_TOKEN` name, description, example), and Running Locally (`vercel dev`).
2. Add a Deployment section: create a Vercel project via `vercel` CLI or the Vercel dashboard; connect the GitHub repo; add `HF_API_TOKEN` as an environment variable in Project Settings → Environment Variables; Vercel auto-detects the `api/` folder and deploys functions automatically.
3. Note that `HF_API_TOKEN` requires a free Hugging Face account — include a link to `huggingface.co/settings/tokens`.

**Relevant Context:**

- No session secret or password variables are needed — the only secret is `HF_API_TOKEN`.
- Vercel provisions HTTPS automatically on all deployments.
- `vercel dev` reads `.env.local` for secrets during local development, mirroring the production environment.

**Status:** `[ ] pending`

---

### Sub-Task 8 — End-to-End Testing & Polish

**Intent:**
Manually test all input paths, rate limiting, the three generation modes, and mobile camera behaviour. Make any small fixes needed to bring the app to a complete, usable state.

**Expected Outcomes:**

- No image + submit → correct inline error shown, no request sent.
- No prompt + submit → correct inline error shown, no request sent.
- Each of the three mode options (shape, artstyle, both) triggers a generation and returns images.
- Image count of 2 and 8 both work correctly.
- Exceeding the rate limit returns a `429` with the rate limit message displayed inline.
- On a real mobile device: tapping the upload box presents options for camera, photo library, and file browser.
- Output images persist on-page until refresh.
- UI is clean and usable at both desktop and mobile widths.

**Todo List:**

1. Test validation: no image error, no prompt error.
2. Test all three modes with a real Hugging Face API token and a sample cookie image.
3. Test count = 2 and count = 8; verify correct number of images returned.
4. Test rate limiting: send more than the allowed number of requests and confirm `429` is shown inline.
5. Test on a mobile device (or browser device emulation): confirm camera prompt appears on upload tap.
6. Review layout on mobile and desktop; adjust CSS as needed.
7. Confirm images persist on-page after generation.

**Relevant Context:**

- `capture="environment"` on the file input is what triggers the camera prompt on mobile; verify it works on both iOS Safari and Android Chrome.
- On desktop browsers, `capture` is silently ignored — the standard file picker opens instead.
- Real Hugging Face calls will be slow on the free tier; test with `count = 2` during development to keep iteration fast.

**Status:** `[ ] pending`
