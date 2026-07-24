# CookieCreate

A web app that generates cookie design ideas from a reference image and a text description. Upload a cookie base or a finished illustration, describe what you want, and get AI-generated design concepts tailored to your shape and/or art style.

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- [Vercel CLI](https://vercel.com/docs/cli) — install globally with `npm install -g vercel`
- A free [Hugging Face](https://huggingface.co) account
- A free [Upstash](https://upstash.com) Redis database

---

## Installation

```bash
npm install
```

---

## Environment Variables

Create a `.env.local` file in the project root with the following values:

| Variable | Description | Where to find it |
|---|---|---|
| `HF_API_TOKEN` | Hugging Face API token (Read access) | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis database REST URL | Upstash dashboard → your database → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis database REST token | Upstash dashboard → your database → REST API |

Example `.env.local`:

```
HF_API_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxx
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

---

## Running Locally

```bash
vercel dev
```

This starts a local server (default: `http://localhost:3000`) that serves the frontend from `public/` and runs `api/generate.js` as a local serverless function. It reads secrets from `.env.local` automatically.

> **Note:** `vercel dev` will prompt you to link the project to your Vercel account the first time. Select your existing `cookie-create` project when asked.

---

## Deployment

CookieCreate is deployed via [Vercel](https://vercel.com). Any push to the `main` branch on GitHub triggers an automatic redeployment.

### First-time setup

1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo.
3. Vercel will auto-detect the project structure (`public/` for static files, `api/` for functions). No build settings need to be changed.
4. Before deploying, add your environment variables in **Project Settings → Environment Variables**:
   - `HF_API_TOKEN`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
5. Click **Deploy**.

### Subsequent deployments

Push to `main` — Vercel redeploys automatically.

---

## Project Structure

```
cookie-create/
├── public/
│   ├── index.html      # Main app page
│   ├── style.css       # All styles (responsive, mobile-first)
│   └── app.js          # Frontend logic (upload preview, validation, fetch)
├── api/
│   └── generate.js     # Vercel serverless function — rate limiting + HF proxy
├── generator.js        # Image generation logic (Hugging Face instruct-pix2pix)
├── vercel.json         # Vercel config
├── .env.local          # Local secrets (never commit this file)
└── package.json
```

---

## How It Works

1. User uploads a reference image (cookie base or finished illustration).
2. User selects an interpretation mode:
   - **Both shape & artstyle** — model preserves the cookie's outline and drawing style.
   - **Shape only** — model preserves the cookie's outline only.
   - **Artstyle only** — model matches the drawing style and line weight only.
3. User enters a text description of the desired design and selects how many images to generate (1–5).
4. The frontend sends the image, prompt, mode, and count to `/api/generate`.
5. The serverless function rate-limits by IP, then calls `generator.js`.
6. `generator.js` fires sequential requests to the Hugging Face `instruct-pix2pix` model and returns base64-encoded images.
7. Generated images are displayed on-page until the browser is refreshed.
