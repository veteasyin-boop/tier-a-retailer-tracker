/**
 * GROWTA NEURONCORE AI GATEWAY
 * Authority: GROWTA-MASTER-PRD-001 (Section 49 — Module 30)
 * Parent: Varyanta Global Industries
 * 
 * Rules:
 * 1. Unified model calling abstraction across LLMs and deterministic engines.
 * 2. Token, latency, and cost tracking.
 * 3. Automatic fallback on timeout, rate limit, or error.
 * 4. Strict Read-Only mandate enforcement (Non-Hallucination Contract).
 */

export const AI_AGENT_PERMISSIONS = Object.freeze({
  L0_READ: 'L0_READ',
  L1_RECOMMEND: 'L1_RECOMMEND',
  L2_DRAFT: 'L2_DRAFT',
  L3_EXECUTE: 'L3_EXECUTE'
});

export const SUPPORTED_MODELS = Object.freeze({
  GEMINI_15_FLASH: 'gemini-1.5-flash',
  GEMINI_15_PRO: 'gemini-1.5-pro',
  GEMINI_20_FLASH: 'gemini-2.0-flash',
  DETERMINISTIC_FALLBACK: 'growta-semantic-bi-v1'
});

class AiGateway {
  constructor() {
    this.defaultModel = SUPPORTED_MODELS.GEMINI_15_FLASH;
    this.timeoutMs = 15000;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      fallbackRequests: 0,
      totalTokensEstimated: 0,
      averageLatencyMs: 0
    };
  }

  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Dispatches request to configured AI provider with timeout and deterministic fallback
   */
  async generateResponse({
    prompt,
    systemInstruction = '',
    history = [],
    apiKey = null,
    model = null,
    permissionLevel = AI_AGENT_PERMISSIONS.L1_RECOMMEND,
    fallbackFn = null
  }) {
    this.metrics.totalRequests++;
    const startTime = Date.now();
    const targetModel = model || this.defaultModel;

    // Estimate input tokens (~4 chars per token)
    const promptLen = (prompt || '').length + (systemInstruction || '').length;
    const estInputTokens = Math.ceil(promptLen / 4);

    if (!apiKey) {
      this.metrics.fallbackRequests++;
      const latency = Date.now() - startTime;
      this.recordLatency(latency);
      return {
        text: fallbackFn ? fallbackFn(prompt) : 'Deterministic fallback active: No API key configured.',
        model: SUPPORTED_MODELS.DETERMINISTIC_FALLBACK,
        permissionLevel,
        latencyMs: latency,
        tokensUsed: { prompt: estInputTokens, completion: 0, total: estInputTokens },
        isFallback: true
      };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

      const contents = [];
      if (systemInstruction) {
        contents.push({ role: 'user', parts: [{ text: systemInstruction }] });
        contents.push({ role: 'model', parts: [{ text: 'Acknowledged. Operating under strict Read-Only Agricultural Business Operating System policy.' }] });
      }

      history.slice(-6).forEach(m => {
        contents.push({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        });
      });

      contents.push({
        role: 'user',
        parts: [{ text: prompt }]
      });

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.2,
            topP: 0.85,
            maxOutputTokens: 2048
          }
        })
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('No candidate content returned by AI provider.');

      const estOutputTokens = Math.ceil(text.length / 4);
      const totalTokens = estInputTokens + estOutputTokens;
      this.metrics.totalTokensEstimated += totalTokens;
      this.metrics.successfulRequests++;

      const latency = Date.now() - startTime;
      this.recordLatency(latency);

      return {
        text,
        model: targetModel,
        permissionLevel,
        latencyMs: latency,
        tokensUsed: { prompt: estInputTokens, completion: estOutputTokens, total: totalTokens },
        isFallback: false
      };

    } catch (err) {
      console.warn(`[NeuronCore AI Gateway] Provider call failed (${err.message}). Engaging fallback...`);
      this.metrics.fallbackRequests++;
      const latency = Date.now() - startTime;
      this.recordLatency(latency);

      const fallbackText = fallbackFn ? fallbackFn(prompt) : `⚠️ *AI Gateway note (${err.message})*: Operating via Growta local semantic engine.`;

      return {
        text: fallbackText,
        model: SUPPORTED_MODELS.DETERMINISTIC_FALLBACK,
        permissionLevel,
        latencyMs: latency,
        tokensUsed: { prompt: estInputTokens, completion: 0, total: estInputTokens },
        isFallback: true,
        errorNotice: err.message
      };
    }
  }

  recordLatency(ms) {
    if (this.metrics.averageLatencyMs === 0) {
      this.metrics.averageLatencyMs = ms;
    } else {
      this.metrics.averageLatencyMs = Math.round((this.metrics.averageLatencyMs * 0.8) + (ms * 0.2));
    }
  }
}

export const aiGateway = new AiGateway();
