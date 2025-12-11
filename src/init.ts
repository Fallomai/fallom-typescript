/**
 * Combined initialization for trace, models, and prompts.
 */

import * as trace from "./trace";
import * as models from "./models";
import * as prompts from "./prompts";

export interface InitOptions {
  apiKey?: string;
  tracesUrl?: string;
  configsUrl?: string;
  promptsUrl?: string;
  captureContent?: boolean;
  debug?: boolean;
}

/**
 * Initialize trace, models, and prompts at once.
 *
 * @param options - Configuration options
 * @param options.apiKey - Your Fallom API key. Defaults to FALLOM_API_KEY env var.
 * @param options.tracesUrl - Traces API URL. Defaults to FALLOM_TRACES_URL or https://traces.fallom.com
 * @param options.configsUrl - Configs API URL. Defaults to FALLOM_CONFIGS_URL or https://configs.fallom.com
 * @param options.promptsUrl - Prompts API URL. Defaults to FALLOM_PROMPTS_URL or https://prompts.fallom.com
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
 * fallom.init({
 *   tracesUrl: "http://localhost:3002",
 *   configsUrl: "http://localhost:3003",
 *   promptsUrl: "http://localhost:3004"
 * });
 *
 * // Privacy mode
 * fallom.init({ captureContent: false });
 * ```
 */
export async function init(options: InitOptions = {}): Promise<void> {
  const tracesUrl =
    options.tracesUrl ||
    process.env.FALLOM_TRACES_URL ||
    "https://traces.fallom.com";

  const configsUrl =
    options.configsUrl ||
    process.env.FALLOM_CONFIGS_URL ||
    "https://configs.fallom.com";

  const promptsUrl =
    options.promptsUrl ||
    process.env.FALLOM_PROMPTS_URL ||
    "https://prompts.fallom.com";

  await trace.init({
    apiKey: options.apiKey,
    baseUrl: tracesUrl,
    captureContent: options.captureContent,
    debug: options.debug,
  });

  models.init({
    apiKey: options.apiKey,
    baseUrl: configsUrl,
  });

  prompts.init({
    apiKey: options.apiKey,
    baseUrl: promptsUrl,
  });
}
