/**
 * Helper functions for creating models and datasets.
 */

import type {
  Model,
  ModelCallable,
  DatasetItem,
  CustomMetric,
  Message,
} from "./types";

/**
 * Create a Model using OpenAI directly (for fine-tuned models or Azure OpenAI).
 *
 * @param modelId - The OpenAI model ID (e.g., "gpt-4o" or "ft:gpt-4o-2024-08-06:org::id")
 * @param options - Configuration options
 * @returns Model instance that can be used in compareModels()
 */
export function createOpenAIModel(
  modelId: string,
  options: {
    name?: string;
    apiKey?: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Model {
  const { name, apiKey, baseUrl, temperature, maxTokens } = options;

  const callFn: ModelCallable = async (messages: Message[]) => {
    // Dynamic import to avoid requiring openai if not used
    const openaiApiKey = apiKey || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error(
        "OpenAI API key required. Set OPENAI_API_KEY env var or pass apiKey option."
      );
    }

    const requestBody: Record<string, unknown> = {
      model: modelId,
      messages,
    };
    if (temperature !== undefined) requestBody.temperature = temperature;
    if (maxTokens !== undefined) requestBody.max_tokens = maxTokens;

    const response = await fetch(
      baseUrl || "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string | null } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      content: data.choices[0].message.content || "",
      tokensIn: data.usage?.prompt_tokens,
      tokensOut: data.usage?.completion_tokens,
    };
  };

  return { name: name || modelId, callFn };
}

/**
 * Create a Model for any OpenAI-compatible API endpoint.
 *
 * Works with self-hosted models (vLLM, Ollama, LMStudio, etc.), custom endpoints,
 * or any service that follows the OpenAI chat completions API format.
 *
 * @param name - Display name for the model
 * @param options - Configuration options
 * @returns A Model instance
 */
export function createCustomModel(
  name: string,
  options: {
    endpoint: string;
    apiKey?: string;
    headers?: Record<string, string>;
    modelField?: string;
    modelValue?: string;
    extraParams?: Record<string, unknown>;
  }
): Model {
  const {
    endpoint,
    apiKey,
    headers = {},
    modelField = "model",
    modelValue,
    extraParams = {},
  } = options;

  const callFn: ModelCallable = async (messages: Message[]) => {
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };
    if (apiKey) {
      requestHeaders.Authorization = `Bearer ${apiKey}`;
    }

    const payload = {
      [modelField]: modelValue || name,
      messages,
      ...extraParams,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_cost?: number;
      };
    };
    return {
      content: data.choices[0].message.content,
      tokensIn: data.usage?.prompt_tokens,
      tokensOut: data.usage?.completion_tokens,
      cost: data.usage?.total_cost,
    };
  };

  return { name, callFn };
}

/**
 * Create a Model from any callable function.
 *
 * This is the most flexible option - you provide a function that takes
 * messages and returns a response.
 *
 * @param name - Display name for the model
 * @param callFn - Function that takes messages and returns a response
 * @returns A Model instance
 */
export function createModelFromCallable(
  name: string,
  callFn: ModelCallable
): Model {
  return { name, callFn };
}

/**
 * Create a custom evaluation metric using G-Eval.
 *
 * @param name - Unique identifier for the metric (e.g., "brand_alignment")
 * @param criteria - Description of what the metric evaluates
 * @param steps - List of evaluation steps for the LLM judge to follow
 * @returns A CustomMetric instance
 */
export function customMetric(
  name: string,
  criteria: string,
  steps: string[]
): CustomMetric {
  return { name, criteria, steps };
}

/**
 * Create a dataset from Fallom trace data.
 *
 * @param traces - List of trace objects with attributes
 * @returns List of DatasetItem ready for evaluation
 */
export function datasetFromTraces(
  traces: Array<{ attributes?: Record<string, unknown> }>
): DatasetItem[] {
  const items: DatasetItem[] = [];

  for (const trace of traces) {
    const attrs = trace.attributes || {};
    if (Object.keys(attrs).length === 0) continue;

    // Extract input (last user message)
    let inputText = "";
    for (let i = 0; i < 100; i++) {
      const role = attrs[`gen_ai.prompt.${i}.role`];
      if (role === undefined) break;
      if (role === "user") {
        inputText = (attrs[`gen_ai.prompt.${i}.content`] as string) || "";
      }
    }

    // Extract output
    const outputText = (attrs["gen_ai.completion.0.content"] as string) || "";

    // Extract system message
    let systemMessage: string | undefined;
    if (attrs["gen_ai.prompt.0.role"] === "system") {
      systemMessage = attrs["gen_ai.prompt.0.content"] as string;
    }

    if (inputText && outputText) {
      items.push({
        input: inputText,
        output: outputText,
        systemMessage,
      });
    }
  }

  return items;
}

/**
 * Fetch a dataset stored in Fallom by its key.
 *
 * @param datasetKey - The unique key of the dataset (e.g., "customer-support-qa")
 * @param version - Specific version number to fetch. If undefined, fetches latest.
 * @param config - Internal config (api key, base url, initialized flag)
 * @returns List of DatasetItem ready for evaluation
 */
export async function datasetFromFallom(
  datasetKey: string,
  version?: number,
  config?: {
    _apiKey?: string | null;
    _baseUrl?: string;
    _initialized?: boolean;
  }
): Promise<DatasetItem[]> {
  // Import here to avoid circular dependency
  const { _apiKey, _baseUrl, _initialized } = await import("./core").then(
    (m) => ({
      _apiKey: config?._apiKey ?? m._apiKey,
      _baseUrl: config?._baseUrl ?? m._baseUrl,
      _initialized: config?._initialized ?? m._initialized,
    })
  );

  if (!_initialized) {
    throw new Error("Fallom evals not initialized. Call evals.init() first.");
  }

  // Build URL
  let url = `${_baseUrl}/api/datasets/${encodeURIComponent(datasetKey)}`;
  if (version !== undefined) {
    url += `?version=${version}`;
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${_apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 404) {
    throw new Error(`Dataset '${datasetKey}' not found`);
  } else if (response.status === 403) {
    throw new Error(`Access denied to dataset '${datasetKey}'`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch dataset: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    entries?: Array<{
      input: string;
      output: string;
      systemMessage?: string;
      metadata?: Record<string, unknown>;
    }>;
    dataset?: { name?: string };
    version?: { version?: number };
  };

  // Convert to DatasetItem list
  const items: DatasetItem[] = [];
  for (const entry of data.entries || []) {
    items.push({
      input: entry.input,
      output: entry.output,
      systemMessage: entry.systemMessage,
      metadata: entry.metadata,
    });
  }

  const datasetName = data.dataset?.name || datasetKey;
  const versionNum = data.version?.version || "latest";
  console.log(
    `✓ Loaded dataset '${datasetName}' (version ${versionNum}) with ${items.length} entries`
  );

  return items;
}

