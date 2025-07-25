const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ApiError } = require('../utils/errorHandler');
const config = require('../../config');

// Initialize Google Generative AI client
const genAI = new GoogleGenerativeAI(config.ai.apiKey);

/**
 * Strip HTML tags from article description
 */
function stripHtml(html) {
  return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
}

/**
 * Summarize a single article using Gemini
 */
const summarizeSingleArticle = async (article, language = 'english', retryCount = 0) => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: config.ai.model,
      generationConfig: {
        maxOutputTokens: config.ai.maxTokens,
        temperature: config.ai.temperature,
      }
    });

    const cleanDescription = stripHtml(article.description || article.sDescription || '');

    let prompt;
    if (language === 'hindi') {
      prompt = `आपको एक समाचार लेख का title aur विवरण दिया गया है। कृपया केवल नीचे दिए गए JSON प्रारूप में हिंदी में 50-60 शब्दों का सारांश बनाएं।

नियम:
- केवल मान्य JSON लौटाएं
- कोड ब्लॉक, मार्कडाउन या अतिरिक्त टेक्स्ट न जोड़ें

{
  "title": "<हिंदी शीर्षक>",
  "summary": "<हिंदी में 50-60 शब्दों का सारांश>"
}

विवरण: ${cleanDescription} ${article.title ? `शीर्षक: ${article.title}` : (article.sTitle || '')}

केवल ऊपर के JSON प्रारूप में उत्तर दें।`;
    } else {
      prompt = `You are given the title and description of a news article. Write a clear, 50–60 word summary in English.

Instructions:
- Output only valid JSON.
- Do NOT include markdown, code blocks, or extra text.
- The response must exactly match this format:

{
  "title": "<Title in English>",
  "summary": "<50–60 word summary in English>"
}

Description: ${cleanDescription} ${article.title ? `Title: ${article.title}` : (article.sTitle || '')}

Now respond ONLY in the above JSON format.`;
    }

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();
    console.log('🧪 Gemini raw output:', rawText);

    if (!rawText || rawText.length < 10) {
      // throw new Error('Empty response from model');
      return {}
    }

    let cleanedText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/```$/, '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\\"/g, '"')
      .trim();

    console.log('🧹 Cleaned output:', cleanedText);

    let parsed;

    try {
      parsed = JSON.parse(cleanedText);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    } catch (err) {
      const match = cleanedText.match(/"title"\s*:\s*"([^"]+)",\s*"summary"\s*:\s*"([^"]+)"/);
      if (match) {
        parsed = {
          title: match[1],
          summary: match[2]
        };
      } else {
        throw new Error('Failed to parse summary JSON');
      }
    }

    const summaries = Array.isArray(parsed) ? parsed[0] : parsed;

    if (!summaries || !summaries.summary || typeof summaries.summary !== 'string' || summaries.summary.length < 10) {
      throw new Error('Summary too short or missing');
    }

    console.log('✅ Final parsed summaries:', summaries);
    return summaries;

  } catch (error) {
    console.warn(`⚠️ Error on attempt ${retryCount + 1} for article "${article.title}":`, error.message);

    if (retryCount < 1) {
      console.log(`🔁 Retrying summarization for "${article.title}"...`);
      return summarizeSingleArticle(article, language, retryCount + 1);
    }

    // Final fallback if retry also fails
    return {
      title: article.title || 'Untitled',
      summary: 'Summary not generated due to repeated model failure.'
    };
  }
};


/**
 * Summarize multiple articles
 */
const summarizeArticles = async (articles, language = 'english') => {
  try {
    
    const summarizationPromises = articles.map(article =>
      summarizeSingleArticle(article, language)
    );
    const summarizedArticles = await Promise.all(summarizationPromises);
    return summarizedArticles;
  } catch (error) {
    console.error('Error in batch summarization:', error);
    throw new ApiError(500, 'Failed to summarize articles');
  }
};

/**
 * Validate Google API key
 */
const validateApiKey = async () => {
  try {
    if (!config.ai.apiKey) {
      throw new Error('Google API key is not configured');
    }
    const model = genAI.getGenerativeModel({ model: config.ai.model });
    const result = await model.generateContent("Hello");
    await result.response;
    return true;
  } catch (error) {
    console.error('Google API key validation failed:', error);
    return false;
  }
};

module.exports = {
  summarizeArticles,
  summarizeSingleArticle,
  validateApiKey
};
