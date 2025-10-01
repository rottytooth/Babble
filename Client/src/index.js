const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Check if parser directory exists
const parserPath = path.join(__dirname, '..', 'parser');

app.get('/', (req, res) => {
  res.json({
    message: 'Babble Client API',
    version: '1.0.0',
    parserAvailable: fs.existsSync(parserPath)
  });
});

app.get('/parser-status', (req, res) => {
  if (fs.existsSync(parserPath)) {
    try {
      const files = fs.readdirSync(parserPath);
      res.json({
        status: 'available',
        files: files,
        path: parserPath
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  } else {
    res.json({
      status: 'not_found',
      message: 'Parser directory not found. Run "npm run build" first.',
      path: parserPath
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Babble Client server running on port ${PORT}`);
  console.log(`Parser directory: ${fs.existsSync(parserPath) ? 'Found' : 'Not found'}`);
  console.log('Run "npm run build" to copy Parser contents if needed');
});
