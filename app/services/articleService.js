const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ApiError } = require('../utils/errorHandler');
const config = require('../../config');
const { parse } = require('dotenv');

// Initialize Google Generative AI client
const genAI = new GoogleGenerativeAI(config.ai.apiKey);

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
}

/**
 * Get the best available title and description from article object
 */
function extractArticleContent(article) {
  const title = article.title || article.sTitle || article.shortTitle || 'Untitled';
  const description = article.description || article.sDescription  || '';
  const content =  article.sContent || article.content || '';
  
  return { title, description, content };
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

    const { title, description, content } = extractArticleContent(article);
    let cleanDescription = stripHtml(description);

    if (content) {
      const cleanedContent = stripHtml(content);
      cleanDescription = cleanedContent;
    }

    if (!cleanDescription || cleanDescription.length < 10) {
      throw new Error('Article description is too short or missing');
    }

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

विवरण: ${cleanDescription}
शीर्षक: ${title}

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

Description: ${cleanDescription}
Title: ${title}

Now respond ONLY in the above JSON format.`;
    }

    let result;
    try {
      result = await model.generateContent(prompt);
      console.log(result.response);
    } catch (error) {
      console.log(error);
    }

    const rawText = result.response.text().trim();
    console.log('🧪 Gemini raw output:', rawText);

    if (!rawText || rawText.length < 10) {
      return {
        title: title,
        summary: 'Summary not generated due to empty response from model.'
      };
    }

    let cleanedText = rawText
      .replace(/^```json/i, '')
      .replace(/^```/, '')
      .replace(/```$/, '')
      .trim();

    let parsed;

    try {
      parsed = JSON.parse(cleanedText);
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed); // handle double-stringified JSON
      }
    } catch (err) {
      console.warn('❌ JSON.parse failed. Attempting regex fallback…');

      const match = cleanedText.match(/"title"\s*:\s*"([^"]+)"\s*,\s*"summary"\s*:\s*"([^"]+)"/i);
      if (match) {
        parsed = {
          title: match[1],
          summary: match[2]
        };
      } else {
        throw new Error('Failed to parse summary JSON');
      }
    }

    return parsed;

  } catch (error) {
    console.warn(`⚠️ Error on attempt ${retryCount + 1} for article "${article.title || article.sTitle}":`, error.message);

    if (retryCount < 1) {
      console.log(`🔁 Retrying summarization for "${article.title || article.sTitle}"...`);
      return summarizeSingleArticle(article, language, retryCount + 1);
    }

    return {
      title: article.title || article.sTitle || 'Untitled',
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
