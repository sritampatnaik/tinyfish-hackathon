# Hume Video Analyzer

Next.js demo for submitting bundled speaking clips to Hume Expression Measurement
and reviewing face, prosody, and language insights in one dashboard.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add your Hume API key:

```bash
cp .env.example .env.local
```

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
- The UI renders dominant emotions, prosody moments, language sentiment, and
  tracked face summaries.
