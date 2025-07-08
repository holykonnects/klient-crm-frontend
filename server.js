// server.js
const express = require('express');
const fetch = require('node-fetch'); // for making HTTP requests
const cors = require('cors');

const app = express();
const PORT = 5000;

// Allow CORS from your React app
app.use(cors());
app.use(express.json()); // Parse JSON request bodies

// Proxy endpoint for login
app.post('/api/login', async (req, res) => {
  try {
    const response = await fetch('https://script.google.com/macros/s/AKfycbzl-2rhvZEeVj3vvV1tLvv1zJlOQ6xxDlttVXOePHwJ0A_0JCp3a_TWIC-dpPE_2g3wZA/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.json(data); // send result back to frontend
  } catch (error) {
    console.error('🔴 Proxy error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Proxy server running at http://localhost:${PORT}`);
});
