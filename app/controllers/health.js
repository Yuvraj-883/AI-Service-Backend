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
  healthCheck
};
