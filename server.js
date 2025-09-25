const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
require('dotenv').config();

const config = require('./config'); 

const articleRoutes = require('./app/routes/articleRoutes');

const app = express();
const PORT = config.app.port;

// --- THIS IS THE CRITICAL FIX ---
// Tell Express that it's behind a proxy (Vercel) and to trust the X-Forwarded-For header.
// This is required for express-rate-limit to work correctly on Vercel.
app.set('trust proxy', 1);
// --------------------------------

// Security middleware 
app.use(helmet());

// Enable CORS for all origins, as you requested.
app.use(cors());

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(bodyParser.json({ limit: config.performance?.maxPayloadSize || '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: config.performance?.maxPayloadSize || '1mb' }));

// --- Application Routes ---
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

// --- Error Handling ---

// 404 handler for routes that are not found
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global error handler to catch all other errors
app.use((err, req, res, next) => {
  console.error('An unhandled error occurred:', err);
  
  const errorResponse = {
    error: 'Internal Server Error',
    message: config.errorHandling.showDetails ? err.message : 'Something went wrong'
  };

  if (config.errorHandling.showStack && config.env === 'development') {
    errorResponse.stack = err.stack;
  }

  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  res.status(statusCode).json(errorResponse);
});


// --- Server Initialization (Vercel Compatible) ---

// Conditionally start the server only when executed directly
if (require.main === module) {
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
}

// Always export the app for serverless environments
module.exports = app;