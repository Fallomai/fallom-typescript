/**
 * Vercel AI SDK wrapper utilities.
 * 
 * Minimal helpers - most logic is in the microservice.
 */

// Re-export shared sanitizers
export { sanitizeForLogging, sanitizeMetadataOnly } from "../shared-utils";

export function aiSdkDebug(label: string, data: unknown): void {
  console.log(`\n🔍 [Fallom Debug] ${label}:`, JSON.stringify(data, null, 2));
}

/**
 * Provider info extracted from the model object.
 * Helps with debugging what SDK/provider the user is using.
 */
export interface ProviderInfo {
  /** Provider name (e.g., "openai", "anthropic", "openrouter") */
  provider?: string;
  /** Provider ID from the model object */
  providerId?: string;
  /** Base URL if using a custom endpoint */
  baseUrl?: string;
  /** AI SDK version if detectable */
  aiSdkVersion?: string;
  /** Model ID */
  modelId?: string;
  /** Raw provider info for debugging */
  raw?: Record<string, unknown>;
}

/**
 * Extract provider information from the AI SDK model object.
 * This helps identify what SDK/provider the user is using for debugging.
 */
export function extractProviderInfo(
  model: any,
  aiModule?: any,
  result?: any
): ProviderInfo {
  const info: ProviderInfo = {};

  try {
    // Try to get AI SDK version from the module
    if (aiModule) {
      // AI SDK exports version in some builds
      info.aiSdkVersion = aiModule.version ?? aiModule.VERSION ?? undefined;
    }

    if (!model) return info;

    // Model ID
    info.modelId = model.modelId ?? model.id ?? String(model);

    // Provider info - different structures in different versions
    // v5/v6: model.provider or model.config?.provider
    if (model.provider) {
      if (typeof model.provider === "string") {
        info.provider = model.provider;
      } else if (typeof model.provider === "object") {
        info.provider = model.provider.id ?? model.provider.name;
        info.providerId = model.provider.id;
      }
    }

    // Try to get provider ID from the model
    if (model.providerId) {
      info.providerId = model.providerId;
    }

    // Try to extract base URL from various places
    // OpenAI provider: model.config?.baseURL
    // or model.settings?.baseURL
    const baseUrl =
      model.config?.baseURL ??
      model.config?.baseUrl ??
      model.settings?.baseURL ??
      model.settings?.baseUrl ??
      model.baseURL ??
      model.baseUrl;

    if (baseUrl && typeof baseUrl === "string") {
      info.baseUrl = baseUrl;
      
      // Detect provider from base URL if not already set
      if (!info.provider) {
        if (baseUrl.includes("openrouter.ai")) {
          info.provider = "openrouter";
        } else if (baseUrl.includes("api.openai.com")) {
          info.provider = "openai";
        } else if (baseUrl.includes("api.anthropic.com")) {
          info.provider = "anthropic";
        } else if (baseUrl.includes("generativelanguage.googleapis.com")) {
          info.provider = "google";
        } else if (baseUrl.includes("api.mistral.ai")) {
          info.provider = "mistral";
        } else if (baseUrl.includes("api.together.xyz")) {
          info.provider = "together";
        } else if (baseUrl.includes("api.groq.com")) {
          info.provider = "groq";
        } else if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
          info.provider = "local";
        }
      }
    }

    // Try to infer provider from model ID patterns
    if (!info.provider && info.modelId) {
      const modelStr = String(info.modelId).toLowerCase();
      if (modelStr.includes("gpt-") || modelStr.includes("o1-") || modelStr.includes("text-embedding")) {
        info.provider = info.provider ?? "openai";
      } else if (modelStr.includes("claude-")) {
        info.provider = info.provider ?? "anthropic";
      } else if (modelStr.includes("gemini-") || modelStr.includes("gemma-")) {
        info.provider = info.provider ?? "google";
      } else if (modelStr.includes("mistral-") || modelStr.includes("mixtral-")) {
        info.provider = info.provider ?? "mistral";
      } else if (modelStr.includes("llama-") || modelStr.includes("meta-llama")) {
        info.provider = info.provider ?? "meta";
      } else if (modelStr.includes("/")) {
        // OpenRouter style: provider/model (e.g., "openai/gpt-4o")
        info.provider = info.provider ?? "openrouter";
      }
    }

    // Extract from result's response if available
    if (result?.response) {
      if (!info.modelId && result.response.modelId) {
        info.modelId = result.response.modelId;
      }
    }

    // Collect raw info for debugging (non-circular parts)
    info.raw = {};
    if (model.modelId) info.raw.modelId = model.modelId;
    if (model.provider) {
      info.raw.provider = typeof model.provider === "object" 
        ? { id: model.provider.id, name: model.provider.name }
        : model.provider;
    }
    if (model.providerId) info.raw.providerId = model.providerId;
    if (model.specificationVersion) info.raw.specificationVersion = model.specificationVersion;

  } catch {
    // Ignore errors - this is best-effort debugging info
  }

  return info;
}

/**
 * Convert provider info to trace attributes.
 */
export function providerInfoToAttributes(info: ProviderInfo): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};

  if (info.provider) {
    attrs["fallom.provider"] = info.provider;
  }
  if (info.providerId) {
    attrs["fallom.provider_id"] = info.providerId;
  }
  if (info.baseUrl) {
    attrs["fallom.base_url"] = info.baseUrl;
  }
  if (info.aiSdkVersion) {
    attrs["fallom.ai_sdk_version"] = info.aiSdkVersion;
  }
  if (info.raw && Object.keys(info.raw).length > 0) {
    attrs["fallom.provider_raw"] = JSON.stringify(info.raw);
  }

  return attrs;
}
