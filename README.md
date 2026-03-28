# TinyAlpha

TinyAlpha is a Next.js app for submitting bundled speaking clips to Hume
Expression Measurement, reviewing face, prosody, and language insights, then
running TinyFish on Kalshi and Polymarket before asking OpenAI to recommend one
or more market ideas.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add your Hume API key:

```bash
cp .env.example .env.local
```

Set:

- `HUME_API_KEY`
- `TINYFISH_API_KEY`
- `OPENAI_API_KEY`

3. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Bundled samples

The demo now ships with a single locally bundled news sample:

- File: `public/samples/trump-news.mp4`
- Poster: `public/samples/trump-news.jpg`
- Source/license: user-provided media

## How it works

- `POST /api/analyze` uploads the selected local sample video to Hume.
- `GET /api/jobs/[jobId]` polls Hume job status and normalizes predictions.
- `POST /api/markets/analyze` runs the Eyes -> Hands -> Brain chain:
  - Hume summary is used as the `Eyes` context
  - TinyFish extracts US/Iran-related markets from Kalshi and Polymarket as the `Hands`
  - OpenAI compares both and returns a recommendation as the `Brain`
- The UI renders dominant emotions, prosody moments, live market listings, and
  a final recommendation.

## Verification

- Run `npm run lint`
- Run `npm run build`
- Start `npm run dev`
- Analyze the bundled video first
- Then trigger `Run TinyFish + OpenAI` to verify the market and recommendation steps
