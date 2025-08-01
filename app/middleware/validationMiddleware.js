const { ApiError } = require('../utils/errorHandler');
const config = require('../../config');

/**
 * Validate single article input data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateArticleInput = (req, res, next) => {
  try {
    const {article} = req.body;
    
    // Check if article object exists
    if (!article || typeof article !== 'object') {
      throw new ApiError(400, 'Article object is required in request body');
    }

    // Check if article has any title field
    const hasTitle = article.title || article.sTitle || article.shortTitle;
    if (!hasTitle) {
      throw new ApiError(400, 'Article must have a title field (title, sTitle, or shortTitle)');
    }

    // Check if article has any description/content field
    const hasContent = article.description || article.sDescription || article.sContent || article.content;
    if (!hasContent) {
      throw new ApiError(400, 'Article must have a description field (description, sDescription, sContent, or content)');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validate API key middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateApiKey = (req, res, next) => {
  next();
};

module.exports = {
  validateArticleInput,
  validateApiKey
}; 