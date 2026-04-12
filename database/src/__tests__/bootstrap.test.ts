import { describe, it, expect } from "vitest";
import { initializeDatabase, getDatabaseStatus } from "../index.js";

describe("Database Bootstrap", () => {
  it("should initialize database successfully", () => {
    expect(() => {
      initializeDatabase();
    }).not.toThrow();
  });

  it("should return valid database status", () => {
    const status = getDatabaseStatus();
    
    expect(status).toBeDefined();
    expect(status.status).toBe("connected");
    expect(status.dialect).toBe("sqlite");
  });
});
