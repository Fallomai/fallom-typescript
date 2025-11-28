# Fallom SDK (TypeScript)

Model A/B testing and tracing for LLM applications. Zero latency, production-ready.

## Installation

```bash
npm install fallom

# With auto-instrumentation for your LLM provider:
npm install fallom @traceloop/node-server-sdk
```

## Quick Start

```typescript
import fallom from 'fallom';
import OpenAI from 'openai';

// Initialize FIRST - before importing your LLM libraries
fallom.init({ apiKey: 'your-api-key' });

// Set default session context for tracing
fallom.trace.setSession('my-agent', sessionId);

// All LLM calls are now automatically traced!
const openai = new OpenAI();
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## Model A/B Testing

Run A/B tests on models with zero latency. Same session always gets same model (sticky assignment).

```typescript
import { models } from 'fallom';

// Get assigned model for this session
const model = await models.get('summarizer-config', sessionId);
// Returns: "gpt-4o" or "claude-3-5-sonnet" based on your config weights

const agent = new Agent({ model });
await agent.run(message);
```

### Version Pinning

Pin to a specific config version, or use latest (default):

```typescript
// Use latest version (default)
const model = await models.get('my-config', sessionId);

// Pin to specific version
const model = await models.get('my-config', sessionId, { version: 2 });
```

### Fallback for Resilience

Always provide a fallback so your app works even if Fallom is down:

```typescript
const model = await models.get('my-config', sessionId, {
  fallback: 'gpt-4o-mini', // Used if config not found or Fallom unreachable
});
```

**Resilience guarantees:**
- Short timeouts (1-2 seconds max)
- Background config sync (never blocks your requests)
- Graceful degradation (returns fallback on any error)
- Your app is never impacted by Fallom being down

## Tracing

Auto-capture all LLM calls with OpenTelemetry instrumentation.

> ⚠️ **Important:** Auto-tracing only works with supported LLM SDKs (OpenAI, Anthropic, etc.) - not raw HTTP requests. If you're using an OpenAI-compatible API like OpenRouter, LiteLLM, or a self-hosted model, use the OpenAI SDK with a custom `baseURL`:
>
> ```typescript
> import OpenAI from 'openai';
> 
> // OpenRouter, LiteLLM, vLLM, etc.
> const client = new OpenAI({
>   baseURL: 'https://openrouter.ai/api/v1', // or your provider's URL
>   apiKey: 'your-provider-key',
> });
> 
> // Now this call will be auto-traced!
> const response = await client.chat.completions.create({
>   model: 'gpt-4o',
>   messages: [...],
> });
> ```

### Automatic Tracing

```typescript
import fallom from 'fallom';

// Initialize before making LLM calls
fallom.init();

// Set session context
fallom.trace.setSession('my-agent', sessionId);

// All LLM calls automatically traced with:
// - Model, tokens, latency
// - Prompts and completions
// - Your config_key and session_id
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
});
```

### Async Context Propagation

For proper session context across async boundaries, use `runWithSession`:

```typescript
import { trace } from 'fallom';

await trace.runWithSession('my-agent', sessionId, async () => {
  // All LLM calls in here have session context
  await agent.run(message);
  await anotherAsyncOperation();
});
```

### Custom Metrics

Record business metrics that OTEL can't capture automatically:

```typescript
import { trace } from 'fallom';

// Record custom metrics for this session
trace.span({
  outlier_score: 0.8,
  user_satisfaction: 4,
  conversion: true,
});

// Or explicitly specify session (for batch jobs)
trace.span(
  { outlier_score: 0.8 },
  { configKey: 'my-agent', sessionId: 'user123-convo456' }
);
```

## Configuration

### Environment Variables

```bash
FALLOM_API_KEY=your-api-key
FALLOM_BASE_URL=https://spans.fallom.com  # or http://localhost:8001 for local dev
FALLOM_CAPTURE_CONTENT=true  # set to "false" for privacy mode
```

### Initialization Options

```typescript
fallom.init({
  apiKey: 'your-api-key',           // Or use FALLOM_API_KEY env var
  baseUrl: 'https://spans.fallom.com', // Or use FALLOM_BASE_URL env var
  captureContent: true,              // Set false for privacy mode
});
```

### Privacy Mode

For companies with strict data policies, disable prompt/completion capture:

```typescript
// Via parameter
fallom.init({ captureContent: false });

// Or via environment variable
// FALLOM_CAPTURE_CONTENT=false
```

In privacy mode, Fallom still tracks:
- ✅ Model used
- ✅ Token counts
- ✅ Latency
- ✅ Session/config context
- ❌ Prompt content (not captured)
- ❌ Completion content (not captured)

## API Reference

### `fallom.init(options?)`

Initialize the SDK. Call this before making LLM calls for auto-instrumentation.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | `FALLOM_API_KEY` env | Your Fallom API key |
| `baseUrl` | `string` | `https://spans.fallom.com` | API base URL |
| `captureContent` | `boolean` | `true` | Capture prompt/completion text |

### `fallom.models.get(configKey, sessionId, options?)`

Get model assignment for a session.

| Parameter | Type | Description |
|-----------|------|-------------|
| `configKey` | `string` | Your config name from the dashboard |
| `sessionId` | `string` | Unique session/conversation ID (sticky assignment) |
| `options.version` | `number` | Pin to specific version (default: latest) |
| `options.fallback` | `string` | Model to return if anything fails |
| `options.debug` | `boolean` | Enable debug logging |

Returns: `Promise<string>` - The assigned model name

### `fallom.trace.setSession(configKey, sessionId)`

Set trace context. All subsequent LLM calls will be tagged with this session.

### `fallom.trace.runWithSession(configKey, sessionId, fn)`

Run a function with session context that propagates across async boundaries.

### `fallom.trace.clearSession()`

Clear trace context.

### `fallom.trace.span(data, options?)`

Record custom business metrics.

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | `Record<string, unknown>` | Metrics to record |
| `options.configKey` | `string` | Optional if `setSession()` was called |
| `options.sessionId` | `string` | Optional if `setSession()` was called |

### `fallom.trace.shutdown()`

Gracefully shutdown the tracing SDK. Call this on process exit.

## Supported LLM Providers

Auto-instrumentation available for:
- OpenAI (+ OpenAI-compatible APIs: OpenRouter, LiteLLM, vLLM, Ollama, etc.)
- Anthropic
- Cohere
- AWS Bedrock
- Google Generative AI
- Azure OpenAI
- LangChain
- And more via Traceloop

Install `@traceloop/node-server-sdk` for comprehensive LLM instrumentation.

**Note:** You must use the official SDK for your provider. Raw HTTP requests (e.g., `fetch()`) will not be traced. For OpenAI-compatible APIs, use the OpenAI SDK with a custom `baseURL`.

## Examples

See the `../examples/` folder for complete examples:
- `random-fact/` - Simple A/B testing with Hono server

## Requirements

- Node.js >= 18.0.0

## License

MIT

