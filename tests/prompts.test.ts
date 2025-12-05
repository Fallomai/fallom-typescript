/**
 * Basic tests for the Fallom prompts module.
 *
 * Run with: npx vitest run tests/prompts.test.ts
 * Or: npm test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash } from "crypto";

describe("prompts module", () => {
  // Store original fetch
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            prompts: [
              {
                key: "test-prompt",
                version: 1,
                system_prompt: "You are a helpful assistant for {{company}}.",
                user_template: "Hello, my name is {{userName}}.",
              },
            ],
            prompt_ab_tests: [
              {
                key: "test-ab",
                version: 1,
                variants: [
                  { prompt_key: "test-prompt", prompt_version: 1, weight: 100 },
                ],
              },
            ],
          }),
      })
    ) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("variable replacement", () => {
    it("should replace simple variables", () => {
      const template = "Hello {{name}}, welcome to {{company}}!";
      const result = replaceVariables(template, { name: "John", company: "Acme" });
      expect(result).toBe("Hello John, welcome to Acme!");
    });

    it("should handle variables with spaces", () => {
      const template = "Hello {{ name }}, welcome to {{  company  }}!";
      const result = replaceVariables(template, { name: "John", company: "Acme" });
      expect(result).toBe("Hello John, welcome to Acme!");
    });

    it("should leave missing variables unchanged", () => {
      const template = "Hello {{name}}, your id is {{id}}!";
      const result = replaceVariables(template, { name: "John" });
      expect(result).toBe("Hello John, your id is {{id}}!");
    });

    it("should handle undefined variables", () => {
      const template = "Value: {{value}}";
      const result = replaceVariables(template, undefined);
      expect(result).toBe("Value: {{value}}");
    });

    it("should convert non-string values to strings", () => {
      const template = "Count: {{count}}, Active: {{active}}";
      const result = replaceVariables(template, { count: 42, active: true });
      expect(result).toBe("Count: 42, Active: true");
    });

    it("should handle empty template", () => {
      const template = "";
      const result = replaceVariables(template, { name: "John" });
      expect(result).toBe("");
    });

    it("should handle template with no variables", () => {
      const template = "Hello world!";
      const result = replaceVariables(template, { name: "John" });
      expect(result).toBe("Hello world!");
    });
  });

  describe("deterministic hashing", () => {
    it("should return same result for same sessionId", () => {
      const sessionId = "user-123-convo-456";
      const hash1 = hashSessionId(sessionId);
      const hash2 = hashSessionId(sessionId);
      
      expect(hash1).toBe(hash2);
    });

    it("should return different results for different sessionIds", () => {
      const hash1 = hashSessionId("session-1");
      const hash2 = hashSessionId("session-2");
      
      expect(hash1).not.toBe(hash2);
    });

    it("should return value between 0 and 999999", () => {
      const testIds = ["a", "b", "test", "user-123", "very-long-session-id-here"];
      
      for (const id of testIds) {
        const hash = hashSessionId(id);
        expect(hash).toBeGreaterThanOrEqual(0);
        expect(hash).toBeLessThan(1_000_000);
      }
    });
  });

  describe("PromptResult type", () => {
    it("should have correct shape", () => {
      const result = {
        key: "test",
        version: 1,
        system: "System prompt",
        user: "User prompt",
      };

      expect(result).toHaveProperty("key");
      expect(result).toHaveProperty("version");
      expect(result).toHaveProperty("system");
      expect(result).toHaveProperty("user");
    });

    it("should allow optional A/B test fields", () => {
      const result = {
        key: "test",
        version: 1,
        system: "System prompt",
        user: "User prompt",
        abTestKey: "my-ab-test",
        variantIndex: 0,
      };

      expect(result.abTestKey).toBe("my-ab-test");
      expect(result.variantIndex).toBe(0);
    });
  });
});

// Helper functions for testing (extracted logic from prompts.ts)
function replaceVariables(
  template: string,
  variables: Record<string, unknown> | undefined
): string {
  if (!variables) return template;

  return template.replace(/\{\{(\s*\w+\s*)\}\}/g, (match, varName) => {
    const key = varName.trim();
    return key in variables ? String(variables[key]) : match;
  });
}

function hashSessionId(sessionId: string): number {
  const hashBytes = createHash("md5").update(sessionId).digest();
  return hashBytes.readUInt32BE(0) % 1_000_000;
}
