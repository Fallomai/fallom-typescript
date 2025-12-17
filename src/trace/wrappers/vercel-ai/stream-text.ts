/**
 * Vercel AI SDK streamText wrapper.
 *
 * SDK is "dumb" - just captures raw request/response and sends to microservice.
 * All parsing/extraction happens server-side for easier maintenance.
 *
 * IMPORTANT: You must await this function, e.g.:
 *   const { textStream, fullStream } = await streamText({...})
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

function log(...args: unknown[]): void {
  if (isDebugMode()) console.log("[Fallom]", ...args);
}

export function createStreamTextWrapper(
  aiModule: any,
  sessionCtx: SessionContext,
  debug = false
) {
  const ctx = sessionCtx;

  return async (...args: any[]) => {
    const params = args[0] || {};
    const startTime = Date.now();
    const captureContent = shouldCaptureContent();

    const result = await aiModule.streamText(...args);

    if (!isInitialized()) {
      return result;
    }

    const traceCtx =
      getTraceContextStorage().getStore() || getFallbackTraceContext();
    const traceId = traceCtx?.traceId || generateHexId(32);
    const spanId = generateHexId(16);
    const parentSpanId = traceCtx?.parentSpanId;

    let firstTokenTime: number | null = null;
    const modelId =
      params?.model?.modelId || String(params?.model || "unknown");

    // Hook into multiple promises to capture ALL response data including tool calls
    if (result?.usage) {
      Promise.all([
        result.usage.catch(() => null),
        result.text?.catch(() => null),
        result.finishReason?.catch(() => null),
        result.toolCalls?.catch(() => null),
        result.toolResults?.catch(() => null),
        result.steps?.catch(() => null),
        result.responseMessages?.catch(() => null),
      ])
        .then(
          async ([
            rawUsage,
            responseText,
            finishReason,
            toolCalls,
            toolResults,
            steps,
            responseMessages,
          ]) => {
            const endTime = Date.now();

            if (debug || isDebugMode()) {
              console.log(
                "\n🔍 [Fallom Debug] streamText raw usage:",
                JSON.stringify(rawUsage, null, 2)
              );
              console.log(
                "🔍 [Fallom Debug] streamText response text:",
                responseText?.slice(0, 100)
              );
              console.log(
                "🔍 [Fallom Debug] streamText finish reason:",
                finishReason
              );
              console.log(
                "🔍 [Fallom Debug] streamText toolCalls:",
                JSON.stringify(toolCalls, null, 2)
              );
              console.log(
                "🔍 [Fallom Debug] streamText steps count:",
                steps?.length
              );
            }

            let providerMetadata = result?.experimental_providerMetadata;
            if (
              providerMetadata &&
              typeof providerMetadata.then === "function"
            ) {
              try {
                providerMetadata = await providerMetadata;
              } catch {
                providerMetadata = undefined;
              }
            }

            // SDK is dumb - just send ALL raw data, microservice does all parsing
            const attributes: Record<string, unknown> = {
              "fallom.sdk_version": "2",
              "fallom.method": "streamText",
              "fallom.is_streaming": true,
            };

            if (captureContent) {
              // Send raw request params - include EVERYTHING
              attributes["fallom.raw.request"] = JSON.stringify({
                prompt: params?.prompt,
                messages: params?.messages,
                system: params?.system,
                model: modelId,
                tools: params?.tools ? Object.keys(params.tools) : undefined,
                maxSteps: params?.maxSteps,
              });

              // Send COMPLETE raw response - includes all tool call data
              attributes["fallom.raw.response"] = JSON.stringify({
                text: responseText,
                finishReason: finishReason,
                // Tool call data - send everything!
                toolCalls: toolCalls,
                toolResults: toolResults,
                // Multi-step agent data
                steps: steps?.map((step: any) => ({
                  stepType: step?.stepType,
                  text: step?.text,
                  finishReason: step?.finishReason,
                  toolCalls: step?.toolCalls,
                  toolResults: step?.toolResults,
                  usage: step?.usage,
                })),
                // Response messages (includes tool call/result messages)
                responseMessages: responseMessages,
              });
            }

            if (rawUsage) {
              attributes["fallom.raw.usage"] = JSON.stringify(rawUsage);
            }
            if (providerMetadata) {
              attributes["fallom.raw.providerMetadata"] =
                JSON.stringify(providerMetadata);
            }
            if (firstTokenTime) {
              attributes["fallom.time_to_first_token_ms"] =
                firstTokenTime - startTime;
            }

            // Get prompt context if set (one-shot, clears after read)
            const promptCtx = getPromptContext();

            sendTrace({
              config_key: ctx.configKey,
              session_id: ctx.sessionId,
              customer_id: ctx.customerId,
              trace_id: traceId,
              span_id: spanId,
              parent_span_id: parentSpanId,
              name: "streamText",
              kind: "llm",
              model: modelId,
              start_time: new Date(startTime).toISOString(),
              end_time: new Date(endTime).toISOString(),
              duration_ms: endTime - startTime,
              status: "OK",
              time_to_first_token_ms: firstTokenTime
                ? firstTokenTime - startTime
                : undefined,
              is_streaming: true,
              attributes,
              // Prompt context (if prompts.get() or prompts.getAB() was called)
              prompt_key: promptCtx?.promptKey,
              prompt_version: promptCtx?.promptVersion,
              prompt_ab_test_key: promptCtx?.abTestKey,
              prompt_variant_index: promptCtx?.variantIndex,
            }).catch(() => {});
          }
        )
        .catch((error: any) => {
          const endTime = Date.now();
          log("❌ streamText error:", error?.message);

          sendTrace({
            config_key: ctx.configKey,
            session_id: ctx.sessionId,
            customer_id: ctx.customerId,
            trace_id: traceId,
            span_id: spanId,
            parent_span_id: parentSpanId,
            name: "streamText",
            kind: "llm",
            model: modelId,
            start_time: new Date(startTime).toISOString(),
            end_time: new Date(endTime).toISOString(),
            duration_ms: endTime - startTime,
            status: "ERROR",
            error_message: error?.message,
            attributes: {
              "fallom.sdk_version": "2",
              "fallom.method": "streamText",
              "fallom.is_streaming": true,
            },
          }).catch(() => {});
        });
    }

    // Wrap textStream to capture first token time
    if (result?.textStream) {
      const originalTextStream = result.textStream;
      const wrappedTextStream = (async function* () {
        for await (const chunk of originalTextStream) {
          if (!firstTokenTime) {
            firstTokenTime = Date.now();
            log("⏱️ Time to first token:", firstTokenTime - startTime, "ms");
          }
          yield chunk;
        }
      })();

      return new Proxy(result, {
        get(target, prop) {
          if (prop === "textStream") {
            return wrappedTextStream;
          }
          return (target as any)[prop];
        },
      });
    }

    return result;
  };
}
