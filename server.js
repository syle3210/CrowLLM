const express = require("express");

const app = express();

app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

// ==========================================
// CROWLLM CONFIG
// ==========================================

const CROWLLM_API_KEY = process.env.CROWLLM_API_KEY;

const REASONING_EFFORT = "high";

const CROWLLM_URL =
  "https://crowllm.com/v1/chat/completions";

// ==========================================
// CORS
// ==========================================

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "CrowLLM JanitorAI Proxy",
    reasoning_effort: REASONING_EFFORT
  });
});

// ==========================================
// CHAT COMPLETIONS
// ==========================================

app.post("/v1/chat/completions", async (req, res) => {
  try {
    if (!CROWLLM_API_KEY) {
      return res.status(500).json({
        error: {
          message: "CROWLLM_API_KEY is not configured on Render."
        }
      });
    }

    const incoming = req.body || {};

    // Keep the model selected by JanitorAI.
    // This allows you to switch between:
    //
    // mistral-medium-3.5:free
    // mistral-medium:free
    // mistral-large-3:free
    // mistral-large:free
    //
    // and other CrowLLM models normally.

    const payload = {
      ...incoming,

      // Keep whatever model JanitorAI selected.
      model: incoming.model,

      // Apply high reasoning.
      reasoning_effort: REASONING_EFFORT
    };

    console.log("Sending request to CrowLLM:");
    console.log({
      model: payload.model,
      reasoning_effort: payload.reasoning_effort,
      stream: payload.stream
    });

    const response = await fetch(CROWLLM_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CROWLLM_API_KEY}`
      },

      body: JSON.stringify(payload)
    });

    const contentType =
      response.headers.get("content-type") ||
      "application/json";

    res.status(response.status);
    res.setHeader("Content-Type", contentType);

    const body = await response.text();

    console.log("CrowLLM response status:", response.status);

    if (response.status >= 400) {
      console.log("CrowLLM error:", body);
    }

    res.send(body);

  } catch (error) {
    console.error("Proxy error:", error);

    res.status(500).json({
      error: {
        message: "CrowLLM proxy error",
        details: error.message
      }
    });
  }
});

// ==========================================
// START
// ==========================================

app.listen(PORT, () => {
  console.log(
    `CrowLLM proxy running on port ${PORT}`
  );
});
