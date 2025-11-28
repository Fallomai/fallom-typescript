/**
 * Fallom - Model A/B testing and tracing for LLM applications.
 *
 * @example
 * ```typescript
 * import fallom from 'fallom';
 *
 * // Initialize (call this early, before LLM imports if possible)
 * fallom.init({ apiKey: "your-api-key" });
 *
 * // Set session context for tracing
 * fallom.trace.setSession("my-agent", sessionId);
 *
 * // Get A/B tested model
 * const model = await fallom.models.get("my-config", sessionId, {
 *   fallback: "gpt-4o-mini"
 * });
 *
 * // Use with OpenAI
 * const response = await openai.chat.completions.create({
 *   model,
 *   messages: [...]
 * });
 *
 * // Record custom metrics
 * fallom.trace.span({ user_satisfaction: 5 });
 * ```
 */

export * as trace from "./trace";
export * as models from "./models";
export { init } from "./init";
export type { InitOptions } from "./init";

// Re-import for default export
import * as trace from "./trace";
import * as models from "./models";
import { init } from "./init";

export default {
  init,
  trace,
  models,
};
