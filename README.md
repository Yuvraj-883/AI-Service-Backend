# AI Text Summarizer

A Node.js API that uses Google Gemini to summarize articles. Send an array of articles and get back concise summaries.

## Quick Start

1. Install dependencies: `npm install`
2. Set up Gemini API:
   - Get a Gemini API key from Google AI Studio
   - Set environment variables in `.env`
3. Run: `npm run dev`

## Environment Setup

Copy `env.example` to `.env` and configure:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

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
- Google Gemini
- Environment-based configuration
- Rate limiting & security

## License

ISC