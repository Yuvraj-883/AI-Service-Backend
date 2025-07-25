const articleService = require('../services/articleService');
const { ApiError } = require('../utils/errorHandler');

/**
 * Summarize an array of articles
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @param {string} language - 'hindi' or 'english'
 */
const summarizeArticles = async (req, res, next, language = 'english') => {
  try {
    const { articles } = req.body;
    
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      throw new ApiError(400, 'Articles array is required and must not be empty');
    }

    // Validate each article has required fields
    articles.forEach((article, index) => {
      if (!article.title || !article.description) {
        if (!article.sTitle || !article.sDescription) {
          throw new ApiError(400, `Article at index ${index} must have both title and description`);
        }
      }
    });

    const summarizedArticles = await articleService.summarizeArticles(articles, language);
    
    res.status(200).json({
      success: true,
      message: `Articles summarized successfully in ${language}`,
      data: {
        totalArticles: articles.length,
        summarizedArticles
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
};



module.exports = {
  summarizeArticles
}; 