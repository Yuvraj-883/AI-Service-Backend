# AI Text Summarizer

A Node.js API that uses Google Gemini AI to summarize articles. Send an array of articles and get back concise summaries.

## Quick Start

1. Install dependencies: `npm install`
2. Copy `env.example` to `.env` and add your Google API key
3. Run: `npm run dev`

## API

**POST** `/api/articles/summarize`

Send articles and get summaries back.

```json
{
  "articles": [
    {
      "title": "Article Title",
      "description": "Article content here..."
    }
  ]
}
```

## Tech Stack

- Node.js + Express
- Google Gemini AI
- Environment-based configuration
- Rate limiting & security

## License

ISC