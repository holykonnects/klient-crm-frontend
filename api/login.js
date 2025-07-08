export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end(); // Preflight response
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const response = await fetch('https://script.google.com/macros/s/AKfycbzl-2rhvZEeVj3vvV1tLvv1zJlOQ6xxDlttVXOePHwJ0A_0JCp3a_TWIC-dpPE_2g3wZA/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const text = await response.text();

    try {
      const data = JSON.parse(text);
      return res.status(200).json(data);
    } catch (err) {
      console.error('Invalid JSON from Apps Script:', text);
      return res.status(500).json({ success: false, error: 'Invalid JSON from backend' });
    }

  } catch (error) {
    console.error('Proxy error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
