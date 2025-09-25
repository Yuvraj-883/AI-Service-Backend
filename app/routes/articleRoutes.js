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

// POST /api/articles/summarize-long?lang=en|hi
// Summarize multiple long articles into a single consolidated news summary
router.post('/summarize-long', articleController.summarizeLongArticles);

// GET /api/articles/health
router.get('/health', articleController.healthCheck);
router.post('/ping', (req, res) => {
  try {
    console.log('[PING] Endpoint hit successfully.');
    console.log('[PING] Request body received:', JSON.stringify(req.body, null, 2));

    res.status(200).json({
      message: 'Ping successful! The backend is receiving POST requests.',
      dataReceived: req.body
    });
  } catch (error) {
    console.error('[PING] Error in ping endpoint:', error);
    res.status(500).json({ error: 'Ping endpoint failed.' });
  }
});

module.exports = router; 