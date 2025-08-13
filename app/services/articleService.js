const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ApiError } = require('../utils/errorHandler');
const config = require('../../config');

// Initialize Google Generative AI client
const genAI = new GoogleGenerativeAI(config.ai.apiKey);

/**
 * --- Centralized Prompts for easy management and scalability ---
 */
const PROMPTS = {
  hindi: (title, description) => `आप एक विशेषज्ञ समाचार संपादक हैं। आपको दिए गए शीर्षक और विवरण के आधार पर, एक आकर्षक शीर्षक और एक संक्षिप्त, सारगर्भित सारांश हिंदी में तैयार करना है।

**निर्देश:**
1.  प्रतिक्रिया केवल एक मान्य JSON ऑब्जेक्ट होनी चाहिए।
2.  किसी भी तरह का मार्कडाउन, कोड ब्लॉक या अतिरिक्त टेक्स्ट न जोड़ें।
3.  सारांश 50 से 60 शब्दों के बीच होना चाहिए और मुख्य बिंदुओं को उजागर करना चाहिए।
4.  शीर्षक को मूल भाव बनाए रखते हुए अधिक आकर्षक बनाया जा सकता है।
5.  प्रतिक्रिया का प्रारूप बिल्कुल इस तरह होना चाहिए:

\`\`\`json
{
  "title": "<एक आकर्षक हिंदी शीर्षक>",
  "summary": "<यहाँ हिंदी में 50-60 शब्दों का सारांश>"
}
\`\`\`

--- लेख का विवरण ---
**शीर्षक:** ${title}
**विवरण:** ${description}
--- JSON प्रतिक्रिया ---`,

  english: (title, description) => `You are an expert news editor. Based on the provided title and description, craft a compelling new title and a concise 50-60 word summary in English.

**Instructions:**
1.  Your output must be only a single, valid JSON object.
2.  Do NOT include markdown, code blocks, or any other text outside the JSON.
3.  The summary must be 50–60 words and capture the key points of the article.
4.  Paraphrase the original content and title to be unique and engaging, avoiding plagiarism.
5.  The response must exactly match this format:

\`\`\`json
{
  "title": "<A compelling, SEO-friendly title in English>",
  "summary": "<A 50–60 word summary in English>"
}
\`\`\`

--- Article Details ---
**Title:** ${title}
**Description:** ${description}
--- JSON Response ---`
};

/**
 * Helper to strip HTML tags from a string.
 */
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
 * Attempts to parse a string that might be JSON, with fallbacks.
 */
function _parseJsonWithFallback(rawText) {
  const cleanedText = rawText
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim();

  try {
    let parsed = JSON.parse(cleanedText);
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed); // Handle double-stringified JSON
    }
    return parsed;
  } catch (err) {
    console.warn('❌ JSON.parse failed. Attempting regex fallback…');
    const match = cleanedText.match(/"title"\s*:\s*"([^"]+)"\s*,\s*"summary"\s*:\s*"([^"]+)"/i);
    if (match && match && match) {
      return { title: match.trim(), summary: match.trim() };
    }
    // Final fallback if regex fails
    throw new Error('Failed to parse summary JSON from model response.');
  }
}

/**
 * Summarize a single article using Gemini
 */
const summarizeSingleArticle = async (article, language = 'english', retryCount = 0) => {
  const { 
    maxRetries, 
    minContentLength, 
    maxInputLength, 
    retryDelay 
  } = config.ai;

  try {
    const model = genAI.getGenerativeModel({ 
      model: config.ai.model,
      generationConfig: {
        maxOutputTokens: config.ai.maxTokens,
        temperature: config.ai.temperature,
      }
    });

    const { title, description, content } = extractArticleContent(article);
    let cleanContent = stripHtml(description);

    if (content) {
      const fullContent = stripHtml(content);
      if (fullContent.length > cleanContent.length) {
        cleanContent = fullContent;
      }
    }

    if (!cleanContent || cleanContent.length < minContentLength) {
      throw new Error(`Article content is too short (${cleanContent.length} chars) or missing.`);
    }
    
    // --- ADDED: Truncate input to avoid exceeding API token limits ---
    const truncatedContent = cleanContent.substring(0, maxInputLength);

    const prompt = PROMPTS[language](title, truncatedContent);
    if (!prompt) {
      throw new Error(`No prompt available for the selected language: "${language}"`);
    }
    
    const result = await model.generateContent(prompt);
    const response = result.response;

    // --- ADDED: More specific error handling for safety blocks ---
    if (!response || !response.text) {
      const finishReason = response?.promptFeedback?.blockReason || 'UNKNOWN_REASON';
      const safetyRatings = response?.promptFeedback?.safetyRatings || [];
      console.warn(`⚠️ Model returned no text. Finish Reason: ${finishReason}`, { safetyRatings });
      throw new Error(`Content blocked by model for safety reasons: ${finishReason}`);
    }

    const rawText = response.text().trim();
    console.log('🧪 Gemini raw output:', rawText);

    if (!rawText || rawText.length < 10) {
      throw new Error('Model returned an empty or too-short response.');
    }

    return _parseJsonWithFallback(rawText);

  } catch (error) {
    const articleTitle = article.title || article.sTitle || 'Untitled';
    console.warn(`⚠️ Error on attempt ${retryCount + 1} for article "${articleTitle}":`, error.message);

    if (retryCount < maxRetries) {
      console.log(`🔁 Retrying summarization for "${articleTitle}" after ${retryDelay}ms...`);
      // --- ADDED: Wait for a short delay before retrying ---
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return summarizeSingleArticle(article, language, retryCount + 1);
    }

    return {
      title: articleTitle,
      summary: 'Summary not generated due to repeated model failure.'
    };
  }
};

/**
 * Summarize multiple articles
 */
const summarizeArticles = async (articles, language = 'english') => {
  try {
    // Using Promise.allSettled is safer for batch jobs as it won't fail the entire batch if one article fails.
    const summarizationPromises = articles.map(article => 
      summarizeSingleArticle(article, language)
    );
    const results = await Promise.allSettled(summarizationPromises);
    
    // Filter out failed promises if necessary, or map them to a default error state.
    const summarizedArticles = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      const articleTitle = articles[index].title || articles[index].sTitle || 'Untitled';
      console.error(`Final failure for article "${articleTitle}":`, result.reason);
      return {
        title: articleTitle,
        summary: 'Summary failed to generate for this article.'
      };
    });

    return summarizedArticles;
  } catch (error) {
    console.error('Error in batch summarization orchestrator:', error);
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
    await model.generateContent("Hello");
    return true;
  } catch (error) {
    // Log the actual error for debugging, but return a generic failure.
    console.error('Google API key validation failed:', error.message);
    return false;
  }
};

module.exports = {
  summarizeArticles,
  summarizeSingleArticle,
  validateApiKey
};