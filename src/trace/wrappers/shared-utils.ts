/**
 * Shared utilities for SDK wrappers
 */

/**
 * JSON.stringify replacer that sanitizes out large binary data like base64 images.
 * Use with: JSON.stringify(obj, sanitizeForLogging)
 */
export function sanitizeForLogging(key: string, value: unknown): unknown {
  // Skip these keys entirely - they often contain large binary data
  if (key === "rawResponse" || key === "rawCall") {
    return "[omitted]";
  }

  // If it's a string, check if it's base64 image data
  if (typeof value === "string") {
    // Base64 image patterns
    if (value.startsWith("data:image/")) {
      return "[base64 image omitted]";
    }
    // Very long strings (likely base64 or binary) - over 10KB
    if (value.length > 10000) {
      return `[large string omitted: ${value.length} chars]`;
    }
  }

  // If it's a Uint8Array or Buffer, omit it
  if (
    value instanceof Uint8Array ||
    (value && (value as any).type === "Buffer")
  ) {
    return "[binary data omitted]";
  }

  return value;
}

/**
 * JSON.stringify replacer that captures metadata only - strips out actual LLM content.
 * This is useful for debugging provider info without storing massive content.
 * Use with: JSON.stringify(obj, sanitizeMetadataOnly)
 */
export function sanitizeMetadataOnly(key: string, value: unknown): unknown {
  // Keys that contain actual LLM content - strip these
  const contentKeys = [
    "text",
    "content",
    "message",
    "messages",
    "object",
    "prompt",
    "system",
    "input",
    "output",
    "response",
    "toolCalls",
    "toolResults",
    "steps",
    "reasoning",
    "rawResponse",
    "rawCall",
    "body",
    "candidates",
    "parts",
  ];

  if (contentKeys.includes(key)) {
    if (typeof value === "string") {
      return `[content omitted: ${value.length} chars]`;
    }
    if (Array.isArray(value)) {
      return `[content omitted: ${value.length} items]`;
    }
    if (typeof value === "object" && value !== null) {
      return "[content omitted]";
    }
  }

  // If it's a string, check if it's base64 image data
  if (typeof value === "string") {
    if (value.startsWith("data:image/")) {
      return "[base64 image omitted]";
    }
    // Very long strings - over 1KB (more aggressive for metadata-only)
    if (value.length > 1000) {
      return `[large string omitted: ${value.length} chars]`;
    }
  }

  // If it's a Uint8Array or Buffer, omit it
  if (
    value instanceof Uint8Array ||
    (value && (value as any).type === "Buffer")
  ) {
    return "[binary data omitted]";
  }

  return value;
}

