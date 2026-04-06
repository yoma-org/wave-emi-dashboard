export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { image_base64, mime_type } = req.body;
  if (!image_base64) return res.status(400).json({ error: 'Missing image_base64' });

  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });

  // Safety: reject oversized images (Vercel body limit ~4.5MB)
  if (image_base64.length > 3 * 1024 * 1024) {
    return res.status(413).json({ error: 'Image too large (max ~3MB)', employees: [] });
  }

  const prompt = 'Extract the employee/payroll list from this document. Return JSON only: {"employees":[{"name":"Full Name as written","account_or_phone":"phone or account number exactly as shown","amount":0}],"total_amount":0,"employee_count":0,"confidence":0.0}. Rules: Extract EVERY employee row. account_or_phone: copy exact digits. amount: numeric only, no commas. If no employee table found, return empty employees array with confidence 0.';

  try {
    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mime_type || 'image/png'};base64,${image_base64}` } }
          ]
        }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 4000
      })
    });
    const data = await groqResp.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    let parsed;
    try { parsed = JSON.parse(content); }
    catch(e) { parsed = { employees: [], confidence: 0, error: 'AI returned invalid JSON' }; }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message, employees: [], confidence: 0 });
  }
}
