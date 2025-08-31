const { VertexAI } = require('@google-cloud/vertexai');
const { ApiError } = require('../utils/errorHandler');
const config = require('../../config');

const vertexAI = new VertexAI({
  project: config.ai.projectId,
  location: config.ai.location
});
const PROMPTS = {
  hindi: (title, description) => `आप एक विशेषज्ञ SEO और समाचार संपादक हैं। आपका कार्य दिए गए 'शीर्षक' और 'विवरण' को मिलाकर पूरी तरह से अपने शब्दों में एक नया, आकर्षक शीर्षक और सारगर्भित सारांश तैयार करना है।

**निर्देश:**
1.  प्रतिक्रिया केवल एक मान्य JSON ऑब्जेक्ट होनी चाहिए।
2.  किसी भी तरह का मार्कडाउन, कोड ब्लॉक या अतिरिक्त टेक्स्ट न जोड़ें।
3.  **मूल विवरण से सीधे वाक्यांश या वाक्य कॉपी न करें।**
4.  नया शीर्षक आकर्षक, SEO-अनुकूल (SEO-friendly) होना चाहिए और समाचार के मूल सार को प्रस्तुत करना चाहिए।
5.  सारांश 50 से 60 शब्दों में, **आपके अपने शब्दों में लिखा जाना चाहिए**, जिसमें मूल शीर्षक और विवरण दोनों की मुख्य जानकारी शामिल हो।
6.  प्रतिक्रिया का प्रारूप बिल्कुल इस तरह होना चाहिए:

\`\`\`json
{
  "title": "<एक आकर्षक और अनूठा हिंदी शीर्षक>",
  "summary": "<यहाँ हिंदी में 50-60 शब्दों का सारांश, पूरी तरह से अपने शब्दों में>"
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
5.  The summary must be a concise 50-60 words, **written in your own words**, that integrates the key information from both the original title and description.
6. You must paraphrase the title and description/content fully; avoid any direct quotations from the source.
7.  The response must exactly match this format:

\`\`\`json
{
  "title": "<A compelling and unique SEO-friendly title in English>",
  "summary": "<A 50–60 word summary in English, fully paraphrased>"
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
    const model = vertexAI.getGenerativeModel({
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
      const finishReason = response?.promptFeedback?.blockReason || 'UNKNOWN_REASON';
      const safetyRatings = response?.promptFeedback?.safetyRatings || [];
      console.warn(`⚠️ Model returned no text. Finish Reason: ${finishReason}`, { safetyRatings });
      throw new Error(`Content blocked by model for safety reasons: ${finishReason}`);
    }

    const rawText = response.text().trim();
    console.log('🧪 Vertex AI raw output:', rawText);

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
    if (!config.ai.projectId) {
      throw new Error('Google Cloud Project ID is not configured');
    }
    const model = vertexAI.getGenerativeModel({ model: config.ai.model });
    await model.generateContent("Hello");
    return true;
  } catch (error) {
    console.error('Vertex AI validation failed:', error.message);
    return false;
  }
};

const LONG_ARTICLE_PROMPTS = {
  hindi: (combinedContent) => `आप एक विशेषज्ञ समाचार संपादक हैं। निम्नलिखित लेखों को एक एकीकृत समाचार सारांश में संक्षेपित करें जो बिल्कुल 140-160 शब्दों में हो और सभी महत्वपूर्ण घटनाओं को कवर करे।

**महत्वपूर्ण निर्देश:**
1. केवल एक मान्य JSON ऑब्जेक्ट प्रदान करें
2. कोई मार्कडाउन, कोड ब्लॉक या अतिरिक्त टेक्स्ट न जोड़ें
3. सारांश बिल्कुल 180-200 शब्दों में होना चाहिए
4. सभी लेखों की मुख्य जानकारी को एक साथ मिलाएं
5. यदि लेख खाली या अपर्याप्त हैं, तो उपलब्ध जानकारी के साथ काम करें

संक्षेपित करने वाले लेख:
${combinedContent}

केवल इस प्रारूप में JSON प्रतिक्रिया दें:
{
  "title": "<एकीकृत समाचार के लिए आकर्षक हिंदी शीर्षक>",
  "summary": "<140-160 शब्दों में एकीकृत हिंदी सारांश>"
}`,

  english: (combinedContent) => `You are a professional news editor. Summarize the following articles into a single, cohesive news summary of exactly 140-160 words that captures all the important happenings.

**Critical Instructions:**
1. Provide only a valid JSON object
2. Do NOT include markdown, code blocks, or any additional text
3. Summary must be exactly 140-160 words
4. Combine key information from all articles into one coherent narrative
5. If articles are empty or insufficient, work with available information
6. Handle duplicate information by mentioning it once
7. Prioritize the most newsworthy events if content is extensive

Articles to summarize:
${combinedContent}

Provide only a JSON response in this exact format:
{
  "title": "<A compelling headline for the consolidated news>",
  "summary": "<140-160 word unified summary covering all important events>"
}`
};

const summarizeLongArticles = async (articles, language = 'english', retryCount = 0) => {
  const { maxRetries, retryDelay } = config.ai;
  
  try {
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      throw new Error('No articles provided for summarization');
    }

    const model = vertexAI.getGenerativeModel({
      model: config.ai.model,
      generationConfig: {
        maxOutputTokens: config.ai.maxTokens,
        temperature: config.ai.temperature,
      }
    });

    // Combine all articles into a single content block
    const combinedContent = articles.map((article, index) => {
      const { title, description, content } = extractArticleContent(article);
      let cleanContent = stripHtml(content || description || '');
      if (!cleanContent.trim()) {
        cleanContent = 'Content not available';
      }
      
      if (cleanContent.length > 1000) {
        cleanContent = cleanContent.substring(0, 1000) + '...';
      }
      
      return `Article ${index + 1}: ${title}\n${cleanContent}`;
    }).join('\n\n');

    const prompt = LONG_ARTICLE_PROMPTS[language](combinedContent);
    if (!prompt) {
      throw new Error(`No prompt available for language: ${language}`);
    }

    const result = await model.generateContent(prompt);
    const response = result.response;

    if (!response || !response.text) {
      const finishReason = response?.promptFeedback?.blockReason || 'UNKNOWN_REASON';
      throw new Error(`Content blocked by model: ${finishReason}`);
    }

    const rawText = response.text().trim();
    if (!rawText || rawText.length < 10) {
      throw new Error('Model returned empty or too-short response');
    }

    return _parseJsonWithFallback(rawText);

  } catch (error) {
    console.warn(`⚠️ Error on attempt ${retryCount + 1} for long articles summarization:`, error.message);

    if (retryCount < maxRetries) {
      console.log(`🔁 Retrying long articles summarization after ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return summarizeLongArticles(articles, language, retryCount + 1);
    }

    // Fallback response for complete failure
    const fallbackTitle = language === 'hindi' ? 'समाचार सारांश उपलब्ध नहीं' : 'News Summary Unavailable';
    const fallbackSummary = language === 'hindi' 
      ? 'तकनीकी समस्या के कारण समाचार सारांश तैयार नहीं किया जा सका।'
      : 'News summary could not be generated due to technical issues.';
    
    return {
      title: fallbackTitle,
      summary: fallbackSummary
    };
  }
};

module.exports = {
  summarizeArticles,
  summarizeSingleArticle,
  summarizeLongArticles,
  validateApiKey
};