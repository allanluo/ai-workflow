import { describe, it, expect, vi } from "vitest";
import {
  classifyError,
  getRetryPolicy,
  getRetryConfig,
  executeWithRetry
} from "../runtime/errors.js";

describe("Error Handling and Retry Policies", () => {
  describe("Error Classification", () => {
    it("should classify transient errors correctly", () => {
      expect(classifyError("TIMEOUT")).toBe("transient");
      expect(classifyError("NETWORK_ERROR")).toBe("transient");
      expect(classifyError("SERVICE_UNAVAILABLE")).toBe("transient");
    });

    it("should classify permanent errors correctly", () => {
      expect(classifyError("INVALID_INPUT")).toBe("permanent");
      expect(classifyError("INVALID_MODEL")).toBe("permanent");
      expect(classifyError("AUTHENTICATION_FAILED")).toBe("permanent");
    });

    it("should classify user errors correctly", () => {
      expect(classifyError("ASSET_NOT_FOUND")).toBe("user_error");
      expect(classifyError("INVALID_WORKFLOW")).toBe("user_error");
    });

    it("should default unknown errors to permanent", () => {
      expect(classifyError("UNKNOWN_ERROR")).toBe("permanent");
    });
  });

  describe("Retry Policies", () => {
    it("should return fail_fast for permanent errors", () => {
      const policy = getRetryPolicy("permanent");
      expect(policy).toBe("fail_fast");
    });

    it("should return retry_with_backoff for transient errors", () => {
      const policy = getRetryPolicy("transient");
      expect(policy).toBe("retry_with_backoff");
    });
  });

  describe("Retry Configs", () => {
    it("fail_fast should have max_attempts=1", () => {
      const config = getRetryConfig("fail_fast");
      expect(config.max_attempts).toBe(1);
    });

    it("retry_3x should have max_attempts=3", () => {
      const config = getRetryConfig("retry_3x");
      expect(config.max_attempts).toBe(3);
    });

    it("retry_with_backoff should have max_attempts=5", () => {
      const config = getRetryConfig("retry_with_backoff");
      expect(config.max_attempts).toBe(5);
    });
  });

  describe("Execute with Retry", () => {
    it("should succeed on first attempt", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const result = await executeWithRetry(fn, "fail_fast");
      
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on transient failure", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("First failure"))
        .mockResolvedValueOnce("success on retry");

      const result = await executeWithRetry(fn, "retry_3x");
      
      expect(result).toBe("success on retry");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should fail fast with fail_fast policy", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Failed"));
      
      try {
        await executeWithRetry(fn, "fail_fast");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(fn).toHaveBeenCalledTimes(1);
      }
    });

    it("should invoke onRetry callback", async () => {
      const onRetry = vi.fn();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("First failure"))
        .mockResolvedValueOnce("success");

      await executeWithRetry(fn, "retry_3x", onRetry);
      
      expect(onRetry).toHaveBeenCalled();
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });
  });
});
