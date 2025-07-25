const { ApiError } = require('../utils/errorHandler');
const config = require('../../config');

/**
 * Validate article input data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateArticleInput = (req, res, next) => {
  try {
    const { articles } = req.body;

    // Check if articles array exists
    if (!articles) {
      throw new ApiError(400, 'Articles array is required in request body');
    }

    // Check if articles is an array
    if (!Array.isArray(articles)) {
      throw new ApiError(400, 'Articles must be an array');
    }

    // Check if articles array is not empty
    if (articles.length === 0) {
      throw new ApiError(400, 'Articles array cannot be empty');
    }

    // Check if articles array is not too large (prevent abuse)
    if (articles.length > config.validation.maxArticles) {
      throw new ApiError(400, `Cannot process more than ${config.validation.maxArticles} articles at once`);
    }

    // Validate each article object
    articles.forEach((article, index) => {
      if (!article || typeof article !== 'object') {
        throw new ApiError(400, `Article at index ${index} must be an object`);
      }

      if ((!article.title || typeof article.title !== 'string')  ) {
        if(!article.sTitle || typeof article.sTitle !== 'string'){
        throw new ApiError(400, `Article at index ${index} must have a valid title`);

        }
        
      }

      if (!article?.description || typeof article?.description !== 'string') {
        if(!article?.sDescription || typeof article?.sDescription !== 'string'){
          throw new ApiError(400, `Article at index ${index} must have a valid description`);
        }

      }

      // Check length limits
      // if (article?.description?.length > config.validation.maxContentLength) {

      //   throw new ApiError(400, `Article description at index ${index} is too long (max ${config.validation.maxContentLength} characters)`);
      // }

      // if (article.title.length > config.validation.maxTitleLength) {
      //   throw new ApiError(400, `Article title at index ${index} is too long (max ${config.validation.maxTitleLength} characters)`);
      // }
    });

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
  // Skip API key validation if not required in current environment
  if (!config.security.requireApiKey) {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return next(new ApiError(401, 'API key is required'));
  }

  // Add your API key validation logic here
  // For now, we'll just check if it exists
  if (apiKey !== process.env.API_KEY) {
    return next(new ApiError(401, 'Invalid API key'));
  }

  next();
};

module.exports = {
  validateArticleInput,
  validateApiKey
}; 