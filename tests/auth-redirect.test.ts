import { describe, expect, it } from "vitest";

import { getSafeRedirectPath } from "../src/lib/auth/redirect";

describe("getSafeRedirectPath", () => {
  it("keeps a local dashboard path", () => {
    expect(getSafeRedirectPath("/dashboard")).toBe("/dashboard");
  });

  it("keeps local query strings and fragments", () => {
    expect(getSafeRedirectPath("/reset-password/update?step=1#form")).toBe(
      "/reset-password/update?step=1#form",
    );
  });

  it("rejects absolute external URLs", () => {
    expect(getSafeRedirectPath("https://example.com/steal-session")).toBe(
      "/dashboard",
    );
  });

  it("rejects protocol-relative URLs and backslash paths", () => {
    expect(getSafeRedirectPath("//example.com")).toBe("/dashboard");
    expect(getSafeRedirectPath("/\\example.com")).toBe("/dashboard");
  });

  it("uses a supplied fallback for an empty value", () => {
    expect(getSafeRedirectPath(null, "/login")).toBe("/login");
  });
});
