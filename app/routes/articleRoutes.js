const express = require('express');
const router = express.Router();
const articleController = require('../controllers/article');
const { validateArticleInput } = require('../middleware/validationMiddleware');
const { healthCheck } = require('../controllers/health');

// POST /api/articles/summarize/hindi
router.post('/summarize/hindi', validateArticleInput, (req, res, next) => articleController.summarizeArticles(req, res, next, 'hindi'));

// POST /api/articles/summarize/english
router.post('/summarize/english', validateArticleInput, (req, res, next) => articleController.summarizeArticles(req, res, next, 'english'));

// GET /api/articles/health
router.get('/health', healthCheck);

module.exports = router; 