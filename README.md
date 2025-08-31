# AI Text Summarizer

A Node.js API that uses Google Vertex AI to summarize articles. Send an array of articles and get back concise summaries.

## Quick Start

1. Install dependencies: `npm install`
2. Set up Google Cloud credentials:
   - Create a Google Cloud project
   - Enable the Vertex AI API
   - Create a service account and download the JSON key
   - Set environment variables in `.env`
3. Run: `npm run dev`

## Environment Setup

Copy `env.example` to `.env` and configure:

```env
GOOGLE_CLOUD_PROJECT_ID=your_project_id_here
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
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
- Google Vertex AI
- Environment-based configuration
- Rate limiting & security

## License

ISC