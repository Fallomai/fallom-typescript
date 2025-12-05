/**
 * Combined initialization for trace, models, and prompts.
 */

import * as trace from "./trace";
import * as models from "./models";
import * as prompts from "./prompts";

export interface InitOptions {
  apiKey?: string;
  baseUrl?: string;
  captureContent?: boolean;
  debug?: boolean;
}

/**
 * Initialize both trace and models at once.
 *
 * @param options - Configuration options
 * @param options.apiKey - Your Fallom API key. Defaults to FALLOM_API_KEY env var.
 * @param options.baseUrl - API base URL. Defaults to FALLOM_BASE_URL or https://spans.fallom.com
 * @param options.captureContent - Whether to capture prompt/completion content (default: true)
 *
 * @example
 * ```typescript
 * import fallom from 'fallom';
 *
 * // Basic initialization
 * fallom.init({ apiKey: "your-api-key" });
 *
 * // Local development
 * fallom.init({ baseUrl: "http://localhost:8001" });
 *
 * // Privacy mode
 * fallom.init({ captureContent: false });
 * ```
 */
export async function init(options: InitOptions = {}): Promise<void> {
  const baseUrl =
    options.baseUrl ||
    process.env.FALLOM_BASE_URL ||
    "https://spans.fallom.com";

  await trace.init({
    apiKey: options.apiKey,
    baseUrl,
    captureContent: options.captureContent,
    debug: options.debug,
  });

  models.init({
    apiKey: options.apiKey,
    baseUrl,
  });

  prompts.init({
    apiKey: options.apiKey,
    baseUrl,
  });
}
