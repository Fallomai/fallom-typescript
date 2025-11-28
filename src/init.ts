/**
 * Combined initialization for both trace and models.
 */

import * as trace from "./trace";
import * as models from "./models";

export interface InitOptions {
  apiKey?: string;
  baseUrl?: string;
  captureContent?: boolean;
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
export function init(options: InitOptions = {}): void {
  const baseUrl =
    options.baseUrl ||
    process.env.FALLOM_BASE_URL ||
    "https://spans.fallom.com";

  trace.init({
    apiKey: options.apiKey,
    baseUrl,
    captureContent: options.captureContent,
  });

  models.init({
    apiKey: options.apiKey,
    baseUrl,
  });
}

