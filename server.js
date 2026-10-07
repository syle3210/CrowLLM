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
  console.log('>>> Model:', req.body?.model, '| Stream:', req.body?.stream);

  if (!CROWLLM_API_KEY) {
    return res.status(500).json({
      error: { message: 'CROWLLM_API_KEY is not set' }
    });
  }

  try {
    const body = { ...req.body };

    // Only light cleaning
    delete body.extra_body;
    delete body.logit_bias;

    const modelName = (body.model || '').toLowerCase();

    // === Reasoning control ===
    // Add or remove models here as you like
    if (
      modelName.includes('glm') ||
      modelName.includes('deepseek') ||
      modelName.includes('kimi') ||
      modelName.includes('qwen')
    ) {
      // Change this value when you want different effort
      body.reasoning_effort = 'high';
    }

    const isStreaming = body.stream === true;

    const response = await axios({
      method: 'post',
      url: `${CROWLLM_BASE}/chat/completions`,
      headers: {
        'Authorization': `Bearer ${CROWLLM_API_KEY}`,
        'Content-Type': 'application/json',
        ...(isStreaming ? { 'Accept': 'text/event-stream' } : {})
      },
      data: body,
      responseType: isStreaming ? 'stream' : 'json',
      timeout: 180000,
      validateStatus: () => true
    });

    // Handle errors
    if (response.status !== 200) {
      let errorMsg = 'Unknown error';
      try {
        if (typeof response.data === 'string') {
          errorMsg = response.data;
        } else if (response.data?.error?.message) {
          errorMsg = response.data.error.message;
        } else {
          errorMsg = JSON.stringify(response.data).slice(0, 400);
        }
      } catch (e) {
        errorMsg = `CrowLLM status ${response.status}`;
      }

      console.error('CrowLLM Error:', response.status, errorMsg);

      return res.status(response.status).json({
        error: {
          message: errorMsg,
          type: 'upstream_error',
          code: response.status
        }
      });
    }

    // Success
    if (isStreaming) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      response.data.pipe(res);
    } else {
      const data = response.data;

      // Optional: show reasoning in <think> tags
      if (data?.choices?.[0]?.message) {
        const msg = data.choices[0].message;
        const reasoning = msg.reasoning_content || msg.reasoning || '';
        if (reasoning && reasoning.trim()) {
          msg.content = `<think>\n\( {reasoning.trim()}\n</think>\n\n \){msg.content || ''}`;
        }
      }

      res.json(data);
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
