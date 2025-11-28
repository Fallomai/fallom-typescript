/**
 * Fallom tracing module.
 *
 * Auto-instruments all LLM calls via OTEL and groups them by session.
 * Also supports custom spans for business metrics.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ReadableSpan } from '@opentelemetry/sdk-trace-node';
import { Context } from '@opentelemetry/api';

// Session context using AsyncLocalStorage (Node.js equivalent of Python's contextvars)
interface SessionContext {
  configKey: string;
  sessionId: string;
}

const sessionStorage = new AsyncLocalStorage<SessionContext>();

// Module-level fallback for simple cases (when not using runWithSession)
// This mimics Python's contextvars behavior for simpler use cases
let fallbackSession: SessionContext | null = null;

// Module state
let apiKey: string | null = null;
let baseUrl: string = 'https://spans.fallom.com';
let initialized = false;
let captureContent = true;
let sdk: NodeSDK | null = null;

/**
 * Custom SpanProcessor that injects fallom session context into every span.
 * This ensures all auto-instrumented LLM calls get our config_key and session_id.
 */
const fallomSpanProcessor = {
  onStart(span: { setAttribute: (key: string, value: string) => void }, _parentContext: Context): void {
    // Check AsyncLocalStorage first, then fall back to module-level session
    const ctx = sessionStorage.getStore() || fallbackSession;
    if (ctx) {
      span.setAttribute('fallom.config_key', ctx.configKey);
      span.setAttribute('fallom.session_id', ctx.sessionId);
    }
  },

  onEnd(_span: ReadableSpan): void {
    // Nothing to do
  },

  shutdown(): Promise<void> {
    return Promise.resolve();
  },

  forceFlush(): Promise<void> {
    return Promise.resolve();
  },
};

/**
 * Initialize Fallom tracing. Auto-instruments all LLM calls.
 *
 * @param options - Configuration options
 * @param options.apiKey - Your Fallom API key. Defaults to FALLOM_API_KEY env var.
 * @param options.baseUrl - API base URL. Defaults to FALLOM_BASE_URL env var, or https://spans.fallom.com
 * @param options.captureContent - Whether to capture prompt/completion content in traces.
 *                                 Set to false for privacy/compliance. Defaults to true.
 *                                 Also respects FALLOM_CAPTURE_CONTENT env var ("true"/"false").
 *
 * @example
 * ```typescript
 * import fallom from 'fallom';
 *
 * // Normal usage (captures everything)
 * fallom.trace.init();
 *
 * // Privacy mode (no prompts/completions stored)
 * fallom.trace.init({ captureContent: false });
 *
 * fallom.trace.setSession("my-agent", sessionId);
 * await agent.run(message); // Automatically traced
 * ```
 */
export function init(options: {
  apiKey?: string;
  baseUrl?: string;
  captureContent?: boolean;
} = {}): void {
  if (initialized) return;

  apiKey = options.apiKey || process.env.FALLOM_API_KEY || null;
  baseUrl = options.baseUrl || process.env.FALLOM_BASE_URL || 'https://spans.fallom.com';

  // Check env var for captureContent (explicit param takes precedence)
  const envCapture = process.env.FALLOM_CAPTURE_CONTENT?.toLowerCase();
  if (envCapture === 'false' || envCapture === '0' || envCapture === 'no') {
    captureContent = false;
  } else {
    captureContent = options.captureContent ?? true;
  }

  if (!apiKey) {
    throw new Error(
      'No API key provided. Set FALLOM_API_KEY environment variable or pass apiKey parameter.'
    );
  }

  initialized = true;

  // Set up OTEL exporter
  const exporter = new OTLPTraceExporter({
    url: `${baseUrl}/v1/traces`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  // Initialize the SDK
  sdk = new NodeSDK({
    resource: new Resource({
      'service.name': 'fallom-traced-app',
    }),
    traceExporter: exporter,
    spanProcessor: fallomSpanProcessor,
  });

  sdk.start();

  // Auto-instrument LLM libraries
  autoInstrument();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk?.shutdown().catch(console.error);
  });
}

/**
 * Auto-instrument supported LLM libraries using Traceloop's OpenLLMetry.
 */
function autoInstrument(): void {
  try {
    // Try to use Traceloop's SDK for comprehensive LLM instrumentation
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Traceloop } = require('@traceloop/node-server-sdk');
    
    Traceloop.initialize({
      baseUrl: `${baseUrl}/v1/traces`,
      apiKey: apiKey!,
      disableBatch: false,
      // Respect capture content setting
      traceContent: captureContent,
    });
  } catch {
    // Traceloop not installed - that's fine, basic OTEL still works
    // Users can install @traceloop/node-server-sdk for full LLM instrumentation
  }
}

/**
 * Set the current session context.
 *
 * All subsequent LLM calls in this async context will be
 * automatically tagged with this configKey and sessionId.
 *
 * @param configKey - Your config name (e.g., "linkedin-agent")
 * @param sessionId - Your session/conversation ID
 *
 * @example
 * ```typescript
 * trace.setSession("linkedin-agent", sessionId);
 * await agent.run(message); // Automatically traced with session
 * ```
 */
export function setSession(configKey: string, sessionId: string): void {
  // Try to update AsyncLocalStorage if we're inside runWithSession
  const store = sessionStorage.getStore();
  if (store) {
    store.configKey = configKey;
    store.sessionId = sessionId;
  }
  
  // Also set module-level fallback (mimics Python's contextvars behavior)
  // This ensures setSession works even without runWithSession for simple cases
  fallbackSession = { configKey, sessionId };
}

/**
 * Run a function with session context.
 * Use this to ensure session context propagates across async boundaries.
 *
 * @param configKey - Your config name
 * @param sessionId - Your session ID
 * @param fn - Function to run with session context
 *
 * @example
 * ```typescript
 * await trace.runWithSession("my-agent", sessionId, async () => {
 *   await agent.run(message); // Has session context
 * });
 * ```
 */
export function runWithSession<T>(
  configKey: string,
  sessionId: string,
  fn: () => T
): T {
  return sessionStorage.run({ configKey, sessionId }, fn);
}

/**
 * Get current session context, if any.
 */
export function getSession(): SessionContext | undefined {
  return sessionStorage.getStore() || fallbackSession || undefined;
}

/**
 * Clear session context.
 */
export function clearSession(): void {
  // Clear the module-level fallback
  fallbackSession = null;
  // Note: Can't clear AsyncLocalStorage store, it's scoped to runWithSession
}

/**
 * Record custom business metrics. Latest value per field wins.
 *
 * Use this for metrics that OTEL can't capture automatically:
 * - Outlier scores
 * - Engagement metrics
 * - Conversion rates
 * - Any business-specific outcome
 *
 * @param data - Dict of metrics to record
 * @param options - Optional session identifiers
 * @param options.configKey - Config name (optional if setSession was called)
 * @param options.sessionId - Session ID (optional if setSession was called)
 *
 * @example
 * ```typescript
 * // If session context is set:
 * trace.span({ outlier_score: 0.8, engagement: 42 });
 *
 * // Or explicitly:
 * trace.span(
 *   { outlier_score: 0.8 },
 *   { configKey: "linkedin-agent", sessionId: "user123-convo456" }
 * );
 * ```
 */
export function span(
  data: Record<string, unknown>,
  options: {
    configKey?: string;
    sessionId?: string;
  } = {}
): void {
  if (!initialized) {
    throw new Error('Fallom not initialized. Call trace.init() first.');
  }

  // Use context if configKey/sessionId not provided
  const ctx = sessionStorage.getStore() || fallbackSession;
  const configKey = options.configKey || ctx?.configKey;
  const sessionId = options.sessionId || ctx?.sessionId;

  if (!configKey || !sessionId) {
    throw new Error(
      'No session context. Either call setSession() first, or pass configKey and sessionId explicitly.'
    );
  }

  // Send async (fire and forget)
  sendSpan(configKey, sessionId, data).catch(() => {});
}

async function sendSpan(
  configKey: string,
  sessionId: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    await fetch(`${baseUrl}/spans`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config_key: configKey,
        session_id: sessionId,
        data,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
  } catch {
    // Fail silently, don't crash user's code
  }
}

/**
 * Shutdown the tracing SDK gracefully.
 */
export async function shutdown(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    initialized = false;
  }
}

