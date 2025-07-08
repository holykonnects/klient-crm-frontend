// api/login.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const response = await fetch('https://script.google.com/macros/s/AKfycbzl-2rhvZEeVj3vvV1tLvv1zJlOQ6xxDlttVXOePHwJ0A_0JCp3a_TWIC-dpPE_2g3wZA/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}
