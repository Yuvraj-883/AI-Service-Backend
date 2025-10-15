const articleService = require('../services/articleService');
const { ApiError } = require('../utils/errorHandler');

/**
 * Summarize a single article
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @param {string} language - 'hindi' or 'english'
 */
const summarizeArticle = async (req, res, next, language = 'english') => {
  try {
    const {article, wordLimit} = req.body;
    
    if (!article || typeof article !== 'object') {
      throw new ApiError(400, 'Article object is required in request body');
    }

    // Check if article has any content fields
    const hasContent = article.description || article.sDescription || article.sContent || article.content;
    const hasTitle = article.title || article.sTitle || article.shortTitle;
    
    if (!hasContent) {
      throw new ApiError(400, 'Article must have a description field (description, sDescription, sContent, or content)');
    }

    const summarizedArticle = await articleService.summarizeSingleArticle(article, language, wordLimit || '80-100');
    
    res.status(200).json({
      success: true,
      message: `Article summarized successfully in ${language}`,
      data: summarizedArticle,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Summarize multiple long articles into a single consolidated news summary
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const summarizeLongArticles = async (req, res, next) => {
  try {
    const { articles, wordLimit } = req.body;
    const language = req.query.lang === 'hi' ? 'hindi' : 'english';
    
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      throw new ApiError(400, 'Articles array is required and must contain at least one article');
    }

    const consolidatedSummary = await articleService.summarizeLongArticles(articles, language, wordLimit || '140-160');
    
    res.status(200).json({
      success: true,
      message: `Long articles summarized successfully into consolidated summary in ${language}`,
      data: consolidatedSummary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Health check for article service
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const healthCheck = (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Article Summarization Service',
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  summarizeArticle,
  summarizeLongArticles,
  healthCheck
}; 