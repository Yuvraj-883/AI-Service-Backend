const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const { validateArticleInput } = require('../middleware/validationMiddleware');

// POST /api/articles/summarize/:language
// Language can be 'en' for English or 'hi' for Hindi
router.post('/summarize/:language', validateArticleInput, (req, res, next) => {
  const language = req.params.language;
  if (language === 'en') {
    articleController.summarizeArticle(req, res, next, 'english');
  } else if (language === 'hi') {
    articleController.summarizeArticle(req, res, next, 'hindi');
  } else {
    res.status(400).json({
      success: false,
      message: 'Invalid language parameter. Use "en" for English or "hi" for Hindi.'
    });
  }
});

// GET /api/articles/health
router.get('/health', articleController.healthCheck);

module.exports = router; 