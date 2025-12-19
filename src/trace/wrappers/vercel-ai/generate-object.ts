/**
 * Vercel AI SDK generateObject wrapper.
 *
 * SDK is "dumb" - just captures raw request/response and sends to microservice.
 * All parsing/extraction happens server-side for easier maintenance.
 */

import {
  getTraceContextStorage,
  getFallbackTraceContext,
  isInitialized,
  shouldCaptureContent,
  isDebugMode,
  sendTrace,
} from "../../core";
import { generateHexId } from "../../utils";
import type { SessionContext } from "../../types";
import { getPromptContext } from "../../../prompts";

export function createGenerateObjectWrapper(
  aiModule: any,
  sessionCtx: SessionContext,
  debug = false
) {
  const ctx = sessionCtx;

  return async (...args: any[]) => {
    if (!isInitialized()) {
      return aiModule.generateObject(...args);
    }

    const traceCtx =
      getTraceContextStorage().getStore() || getFallbackTraceContext();
    const traceId = traceCtx?.traceId || generateHexId(32);
    const spanId = generateHexId(16);
    const parentSpanId = traceCtx?.parentSpanId;

    const params = args[0] || {};
    const startTime = Date.now();
    const captureContent = shouldCaptureContent();

    try {
      const result = await aiModule.generateObject(...args);
      const endTime = Date.now();

      if (debug || isDebugMode()) {
        console.log(
          "\n🔍 [Fallom Debug] generateObject raw result:",
          JSON.stringify(result, null, 2)
        );
      }

      const modelId =
        result?.response?.modelId ||
        params?.model?.modelId ||
        String(params?.model || "unknown");

      // SDK is dumb - just send raw data
      const attributes: Record<string, unknown> = {
        "fallom.sdk_version": "2",
        "fallom.method": "generateObject",
      };

      if (captureContent) {
        attributes["fallom.raw.request"] = JSON.stringify({
          prompt: params?.prompt,
          messages: params?.messages,
          system: params?.system,
          model: modelId,
          schema: params?.schema ? "provided" : undefined, // Don't send full schema, just note if present
        });

        attributes["fallom.raw.response"] = JSON.stringify({
          object: result?.object,
          finishReason: result?.finishReason,
          responseId: result?.response?.id,
          modelId: result?.response?.modelId,
        });
      }

      if (result?.usage) {
        attributes["fallom.raw.usage"] = JSON.stringify(result.usage);
      }
      if (result?.experimental_providerMetadata) {
        attributes["fallom.raw.providerMetadata"] = JSON.stringify(
          result.experimental_providerMetadata
        );
      }

      // Get prompt context if set (one-shot, clears after read)
      const promptCtx = getPromptContext();

      sendTrace({
        config_key: ctx.configKey,
        session_id: ctx.sessionId,
        customer_id: ctx.customerId,
        metadata: ctx.metadata,
        tags: ctx.tags,
        trace_id: traceId,
        span_id: spanId,
        parent_span_id: parentSpanId,
        name: "generateObject",
        kind: "llm",
        model: modelId,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        duration_ms: endTime - startTime,
        status: "OK",
        attributes,
        // Prompt context (if prompts.get() or prompts.getAB() was called)
        prompt_key: promptCtx?.promptKey,
        prompt_version: promptCtx?.promptVersion,
        prompt_ab_test_key: promptCtx?.abTestKey,
        prompt_variant_index: promptCtx?.variantIndex,
      }).catch(() => {});

      return result;
    } catch (error: any) {
      const endTime = Date.now();
      const modelId =
        params?.model?.modelId || String(params?.model || "unknown");

      sendTrace({
        config_key: ctx.configKey,
        session_id: ctx.sessionId,
        customer_id: ctx.customerId,
        metadata: ctx.metadata,
        tags: ctx.tags,
        trace_id: traceId,
        span_id: spanId,
        parent_span_id: parentSpanId,
        name: "generateObject",
        kind: "llm",
        model: modelId,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        duration_ms: endTime - startTime,
        status: "ERROR",
        error_message: error?.message,
        attributes: {
          "fallom.sdk_version": "2",
          "fallom.method": "generateObject",
        },
      }).catch(() => {});

      throw error;
    }
  };
}
