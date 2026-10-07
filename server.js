import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const CROWLLM_API_KEY = process.env.CROWLLM_API_KEY;
const CROWLLM_BASE = 'https://crowllm.com/v1';

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'CrowLLM Proxy' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', keyConfigured: !!CROWLLM_API_KEY });
});

app.post('/v1/chat/completions', async (req, res) => {
  console.log('>>> Model:', req.body?.model);

  if (!CROWLLM_API_KEY) {
    return res.status(500).json({
      error: { message: 'CROWLLM_API_KEY is not set' }
    });
  }

  try {
    const body = { ...req.body };

    // Light cleaning only
    delete body.extra_body;
    delete body.logit_bias;

    // Force non-stream so we can always read the full error body
    body.stream = false;

    const response = await axios({
      method: 'post',
      url: `${CROWLLM_BASE}/chat/completions`,
      headers: {
        'Authorization': `Bearer ${CROWLLM_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      data: body,
      timeout: 90000,
      validateStatus: () => true,
      responseType: 'text'   // Important: always get text
    });

    console.error('===== FULL CROWLLM RESPONSE =====');
    console.error('Status:', response.status);
    console.error('Body:', response.data);
    console.error('=================================');

    if (response.status !== 200) {
      return res.status(response.status).json({
        error: {
          message: response.data || `CrowLLM returned status ${response.status}`,
          type: 'upstream_error',
          code: response.status
        }
      });
    }

    // Success
    try {
      const data = JSON.parse(response.data);
      res.json(data);
    } catch (e) {
      res.status(500).json({
        error: { message: 'Failed to parse CrowLLM response' }
      });
    }

  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({
      error: {
        message: err.message || 'Internal proxy error',
        type: 'proxy_error',
        code: 500
      }
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CrowLLM Proxy running on port ${PORT}`);
});
