require('dotenv').config();

// Get the current environment
const env = process.env.NODE_ENV || 'development';

// Configuration object with environment variables and defaults
const config = {
  // Environment
  env,
  
  // Application settings
  app: {
    name: process.env.APP_NAME || 'Article Summarization API',
    version: process.env.APP_VERSION || '1.0.0',
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || 'localhost',
    debug: process.env.DEBUG === 'true' || env === 'development',
    logLevel: process.env.LOG_LEVEL || (env === 'development' ? 'debug' : 'info')
  },
  
  // CORS configuration
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : 
            env === 'development' ? ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'] :
            env === 'staging' ? ['https://staging.yourdomain.com'] :
            env === 'production' ? ['https://yourdomain.com'] : '*',
    credentials: process.env.CORS_CREDENTIALS !== 'false'
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 
         env === 'development' ? 1000 :
         env === 'staging' ? 200 :
         env === 'production' ? 100 : 100
  },
  
  // Validation settings
  validation: {
    maxArticles: parseInt(process.env.MAX_ARTICLES) || 50,
    maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH) || 10000,
    maxTitleLength: parseInt(process.env.MAX_TITLE_LENGTH) || 500
  },
  
  // AI Configuration
  ai: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.AI_MODEL || 'gemini-1.5-flash',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 5000,
    temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
    maxRetries: parseInt(process.env.AI_MAX_RETRIES) || 3,
    minContentLength: parseInt(process.env.AI_MIN_CONTENT_LENGTH) || 50,
    maxInputLength: parseInt(process.env.AI_MAX_INPUT_LENGTH) || 8000,
    retryDelay: parseInt(process.env.AI_RETRY_DELAY) || 1000
  },
  
  // Security settings
  security: {
    requireApiKey: process.env.REQUIRE_API_KEY === 'true' || 
                   env === 'staging' || env === 'production',
    apiKey: process.env.API_KEY
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 
           env === 'development' ? 'debug' :
           env === 'staging' ? 'info' :
           env === 'production' ? 'warn' :
           env === 'test' ? 'error' : 'info',
    format: process.env.LOG_FORMAT || 
            env === 'development' ? 'dev' :
            env === 'test' ? 'simple' : 'combined',
    enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false' || env !== 'production',
    enableFile: process.env.LOG_ENABLE_FILE === 'true' || env === 'staging' || env === 'production',
    logFile: process.env.LOG_FILE || 
             env === 'staging' ? 'logs/staging.log' :
             env === 'production' ? 'logs/production.log' : 'logs/app.log'
  },
  
  // Error handling
  errorHandling: {
    showStack: process.env.SHOW_ERROR_STACK === 'true' || env === 'development',
    showDetails: process.env.SHOW_ERROR_DETAILS === 'true' || env === 'development'
  },
  
  // Performance settings
  performance: {
    compression: process.env.ENABLE_COMPRESSION === 'true' || env === 'production',
    cacheControl: process.env.ENABLE_CACHE_CONTROL === 'true' || env === 'production',
    maxPayloadSize: process.env.MAX_PAYLOAD_SIZE || '10mb'
  }
};

// Helper function to get environment-specific value
config.getEnvValue = (key, defaultValue) => {
  return process.env[key] !== undefined ? process.env[key] : defaultValue;
};

// Helper function to check if we're in a specific environment
config.isEnv = (environment) => {
  return config.env === environment;
};

// Helper function to check if we're in production
config.isProduction = () => {
  return config.env === 'production';
};

// Helper function to check if we're in development
config.isDevelopment = () => {
  return config.env === 'development';
};

module.exports = config; 