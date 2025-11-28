# @fallom/trace

Model A/B testing and tracing for LLM applications. Zero latency, production-ready.

## Installation

```bash
npm install @fallom/trace
```

## Quick Start

```typescript
import fallom from "@fallom/trace";
import OpenAI from "openai";

// Initialize Fallom
await fallom.init({ apiKey: "your-api-key" });

// Wrap your LLM client for automatic tracing
const openai = fallom.trace.wrapOpenAI(new OpenAI());

// Set session context
fallom.trace.setSession("my-agent", sessionId);

// All LLM calls are now automatically traced!
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
```

## Model A/B Testing

Run A/B tests on models with zero latency. Same session always gets same model (sticky assignment).

```typescript
import { models } from "@fallom/trace";

// Get assigned model for this session
const model = await models.get("summarizer-config", sessionId);
// Returns: "gpt-4o" or "claude-3-5-sonnet" based on your config weights

const response = await openai.chat.completions.create({ model, ... });
```

### Fallback for Resilience

```typescript
const model = await models.get("my-config", sessionId, {
  fallback: "gpt-4o-mini", // Used if config not found or Fallom unreachable
});
```

## Tracing

Wrap your LLM client once, all calls are automatically traced.

### OpenAI (+ OpenRouter, Azure, LiteLLM, etc.)

```typescript
import OpenAI from "openai";
import fallom from "@fallom/trace";

await fallom.init({ apiKey: "your-api-key" });

// Works with any OpenAI-compatible API
const openai = fallom.trace.wrapOpenAI(
  new OpenAI({
    baseURL: "https://openrouter.ai/api/v1", // or Azure, LiteLLM, etc.
    apiKey: "your-provider-key",
  })
);

fallom.trace.setSession("my-config", sessionId);

// Automatically traced!
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
```

### Anthropic (Claude)

```typescript
import Anthropic from "@anthropic-ai/sdk";
import fallom from "@fallom/trace";

await fallom.init({ apiKey: "your-api-key" });

const anthropic = fallom.trace.wrapAnthropic(new Anthropic());

fallom.trace.setSession("my-config", sessionId);

// Automatically traced!
const response = await anthropic.messages.create({
  model: "claude-3-5-sonnet-20241022",
  messages: [{ role: "user", content: "Hello!" }],
});
```

### Google AI (Gemini)

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import fallom from "@fallom/trace";

await fallom.init({ apiKey: "your-api-key" });

const genAI = new GoogleGenerativeAI(apiKey);
const model = fallom.trace.wrapGoogleAI(
  genAI.getGenerativeModel({ model: "gemini-pro" })
);

fallom.trace.setSession("my-config", sessionId);

// Automatically traced!
const response = await model.generateContent("Hello!");
```

## What Gets Traced

For each LLM call, Fallom automatically captures:
- ✅ Model name
- ✅ Duration (latency)
- ✅ Token counts (prompt, completion, total)
- ✅ Input/output content (can be disabled)
- ✅ Errors
- ✅ Config key + session ID (for A/B analysis)

## Custom Metrics

Record business metrics for your A/B tests:

```typescript
import { trace } from "@fallom/trace";

trace.span({
  outlier_score: 0.8,
  user_satisfaction: 4,
  conversion: true,
});
```

## Configuration

### Environment Variables

```bash
FALLOM_API_KEY=your-api-key
FALLOM_BASE_URL=https://spans.fallom.com
FALLOM_CAPTURE_CONTENT=true  # set to "false" for privacy mode
```

### Privacy Mode

Disable prompt/completion capture:

```typescript
fallom.init({ captureContent: false });
```

## API Reference

### `fallom.init(options?)`

Initialize the SDK.

### `fallom.trace.wrapOpenAI(client)`

Wrap OpenAI client for automatic tracing. Works with any OpenAI-compatible API.

### `fallom.trace.wrapAnthropic(client)`

Wrap Anthropic client for automatic tracing.

### `fallom.trace.wrapGoogleAI(model)`

Wrap Google AI model for automatic tracing.

### `fallom.trace.setSession(configKey, sessionId)`

Set session context for tracing.

### `fallom.models.get(configKey, sessionId, options?)`

Get model assignment for A/B testing. Returns `Promise<string>`.

### `fallom.trace.span(data)`

Record custom business metrics.

## Requirements

- Node.js >= 18.0.0

Works with ESM and CommonJS. Works with tsx, ts-node, Bun, and compiled JavaScript.

## License

MIT
