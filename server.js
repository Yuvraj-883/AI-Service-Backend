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


app.use(helmet());

app.use(cors());

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

app.use(bodyParser.json({ limit: config.performance?.maxPayloadSize || '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: config.performance?.maxPayloadSize || '1mb' }));



app.use('/api/articles', articleRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: `${config.app.name} is running`,
    version: config.app.version,
    environment: config.env,
    timestamp: new Date().toISOString()
  });
});



app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

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

module.exports = app;