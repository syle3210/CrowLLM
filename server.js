const express = require("express");

const app = express();

app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

// ================================
// CROWLLM CONFIGURATION
// ================================

const CROWLLM_API_KEY = process.env.CROWLLM_API_KEY;

// Change this whenever you want to test another model.
const DEFAULT_MODEL =
  process.env.DEFAULT_MODEL || "mistral-medium-3.5:free";

// Reasoning setting.
// We'll experiment with this once the basic proxy works.
const REASONING_EFFORT =
  process.env.REASONING_EFFORT || "high";

// CrowLLM API endpoint.
const CROWLLM_URL =
  "https://crowllm.com/v1/chat/completions";

// ================================
// HEALTH CHECK
// ================================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "CrowLLM JanitorAI Proxy"
  });
});

// ================================
// OPENAI-COMPATIBLE CHAT ENDPOINT
// ================================

app.post("/v1/chat/completions", async (req, res) => {
  try {
    if (!CROWLLM_API_KEY) {
      return res.status(500).json({
        error: {
          message: "CROWLLM_API_KEY is not configured."
        }
      });
    }

    const incoming = req.body || {};

    // Use the model supplied by the client,
    // or fall back to our configured model.
    const model = incoming.model || DEFAULT_MODEL;

    // Build the request that will be sent to CrowLLM.
    const payload = {
      ...incoming,

      model: model,

      // This is the part we're interested in testing.
      reasoning_effort: REASONING_EFFORT
    };

    const response = await fetch(CROWLLM_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CROWLLM_API_KEY}`
      },

      body: JSON.stringify(payload)
    });

    const text = await response.text();

    // Forward CrowLLM's response directly to JanitorAI.
    res.status(response.status);

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") ||
      "application/json"
    );

    res.send(text);

  } catch (error) {
    console.error("Proxy error:", error);

    res.status(500).json({
      error: {
        message: "Proxy error",
        details: error.message
      }
    });
  }
});

// ================================
// START SERVER
// ================================

app.listen(PORT, () => {
  console.log(`CrowLLM proxy running on port ${PORT}`);
});
