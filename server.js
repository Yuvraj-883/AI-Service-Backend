const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
require('dotenv').config();

// Load configuration
const config = require('./config'); 

const articleRoutes = require('./app/routes/articleRoutes');

const app = express();
const PORT = config.app.port;

// Security middleware 
app.use(helmet());
app.use(cors())
// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
app.use(cors(config.cors));

// Body parsing middleware
app.use(bodyParser.json({ limit: config.performance?.maxPayloadSize || '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: config.performance?.maxPayloadSize || '10mb' }));

// Routes
app.use('/api/articles', articleRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: `${config.app.name} is running`,
    version: config.app.version,
    environment: config.env,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  const errorResponse = {
    error: 'Internal server error',
    message: config.errorHandling.showDetails ? err.message : 'Something went wrong'
  };

  // Add stack trace in development
  if (config.errorHandling.showStack && config.env === 'development') {
    errorResponse.stack = err.stack;
  }

  // Always use a numeric status code
  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  res.status(statusCode).json(errorResponse);
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📚 ${config.app.name} v${config.app.version}`);
  console.log(`🌍 Environment: ${config.env}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  
  if (config.app.debug) {
    console.log(`🔧 Debug mode: ${config.app.debug}`);
    console.log(`📝 Log level: ${config.app.logLevel}`);
  }
});

module.exports = app; 