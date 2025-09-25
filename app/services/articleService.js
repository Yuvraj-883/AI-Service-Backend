const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ApiError } = require('../utils/errorHandler');
const config = require('../../config');

const genAI = new GoogleGenerativeAI(config.ai.apiKey);

const PROMPTS = {
  hindi: (title, description) => `आप एक विशेषज्ञ SEO और समाचार संपादक हैं। आपका कार्य दिए गए 'शीर्षक' और 'विवरण' को मिलाकर पूरी तरह से अपने शब्दों में एक नया, आकर्षक शीर्षक और सारगर्भित सारांश तैयार करना है।

**निर्देश:**
1.  प्रतिक्रिया केवल एक मान्य JSON ऑब्जेक्ट होनी चाहिए।
2.  किसी भी तरह का मार्कडाउन, कोड ब्लॉक या अतिरिक्त टेक्स्ट न जोड़ें।
3.  **मूल विवरण से सीधे वाक्यांश या वाक्य कॉपी न करें।**
4.  नया शीर्षक आकर्षक, SEO-अनुकूल (SEO-friendly) होना चाहिए और समाचार के मूल सार को प्रस्तुत करना चाहिए।
5.  सारांश **बिल्कुल 80-100 शब्दों में** होना चाहिए, **आपके अपने शब्दों में लिखा जाना चाहिए**, जिसमें मूल शीर्षक और विवरण दोनों की मुख्य जानकारी शामिल हो। 80 शब्दों से कम या 100 शब्दों से ज्यादा न लिखें।
6.  आपको शीर्षक और विवरण/सामग्री को पूरी तरह से अपने शब्दों में पुनः प्रस्तुत करना होगा; स्रोत से कोई भी प्रत्यक्ष उद्धरण से बचें।
7.  प्रतिक्रिया का प्रारूप बिल्कुल इस तरह होना चाहिए:

\`\`\`json
{
  "title": "<एक आकर्षक और अनूठा हिंदी शीर्षक>",
  "summary": "<यहाँ हिंदी में बिल्कुल 80-100 शब्दों का सारांश, पूरी तरह से अपने शब्दों में>"
}
\`\`\`

--- लेख का विवरण ---
**शीर्षक:** ${title}
**विवरण:** ${description}
--- JSON प्रतिक्रिया ---`,

  english: (title, description) => `You are an expert SEO and news editor. Your task is to synthesize the provided 'Title' and 'Description' into a completely new, paraphrased title and summary.

**Instructions:**
1.  Your output must be only a single, valid JSON object.
2.  Do NOT include markdown, code blocks, or any other text outside the JSON.
3.  **Do not copy phrases or sentences directly from the original description.**
4.  The new title should be compelling, SEO-friendly, and capture the core essence of the news.
5.  The summary must be **exactly 80-100 words**, **written in your own words**, that integrates the key information from both the original title and description. Do not write less than 80 words or more than 100 words.
6. You must paraphrase the title and description/content fully; avoid any direct quotations from the source.
7.  The response must exactly match this format:

\`\`\`json
{
  "title": "<A compelling and unique SEO-friendly title in English>",
  "summary": "<Exactly 80-100 word summary in English, fully paraphrased>"
}
\`\`\`

--- Article Details ---
**Title:** ${title}
**Description:** ${description}
--- JSON Response ---`
};

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
}

function extractArticleContent(article) {
  const title = article.title || article.sTitle || article.shortTitle || 'Untitled';
  const description = article.description || article.sDescription  || '';
  const content =  article.sContent || article.content || '';
  return { title, description, content };
}

function _parseJsonWithFallback(rawText) {
  const cleanedText = rawText
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim();

  try {
    let parsed = JSON.parse(cleanedText);
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed); 
    }
    return parsed;
  } catch (err) {
    console.warn('❌ JSON.parse failed. Attempting regex fallback…');
    const match = cleanedText.match(/"title"\s*:\s*"([^"]+)"\s*,\s*"summary"\s*:\s*"([^"]+)"/i);
    if (match && match[1] && match[2]) {
      return { title: match[1].trim(), summary: match[2].trim() };
    }
    throw new Error('Failed to parse summary JSON from model response.');
  }
}

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
    
    const truncatedContent = cleanContent.substring(0, maxInputLength);

    const prompt = PROMPTS[language](title, truncatedContent);
    if (!prompt) {
      throw new Error(`No prompt available for the selected language: "${language}"`);
    }
    
    const result = await model.generateContent(prompt);
    const response = result.response;

    if (!response || !response.text) {
      throw new Error('Model returned no response');
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
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return summarizeSingleArticle(article, language, retryCount + 1);
    }

    return {
      title: articleTitle,
      summary: 'Summary not generated due to repeated model failure.'
    };
  }
};

const summarizeArticles = async (articles, language = 'english') => {
  try {
    const summarizationPromises = articles.map(article => 
      summarizeSingleArticle(article, language)
    );
    const results = await Promise.allSettled(summarizationPromises);
    
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

const validateApiKey = async () => {
  try {
    if (!config.ai.apiKey) {
      throw new Error('Gemini API key is not configured');
    }
    const model = genAI.getGenerativeModel({ model: config.ai.model });
    await model.generateContent("Hello");
    return true;
  } catch (error) {
    console.error('Gemini API validation failed:', error.message);
    return false;
  }
};

module.exports = {
  summarizeArticles,
  validateApiKey
};