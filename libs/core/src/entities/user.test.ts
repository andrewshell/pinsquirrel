import { describe, it, expect } from "vitest";
import type { User, CreateUserData, UpdateUserData } from "./user.js";

describe("User Entity", () => {
  it("should have correct interface structure", () => {
    const user: User = {
      id: "1",
      email: "test@example.com",
      name: "Test User",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(user.id).toBe("1");
    expect(user.email).toBe("test@example.com");
    expect(user.name).toBe("Test User");
  });

  it("should accept CreateUserData", () => {
    const createData: CreateUserData = {
      email: "test@example.com",
      name: "Test User",
    };

    expect(createData.email).toBe("test@example.com");
    expect(createData.name).toBe("Test User");
  });

  it("should accept UpdateUserData", () => {
    const updateData: UpdateUserData = {
      name: "Updated Name",
    };

    expect(updateData.name).toBe("Updated Name");
  });
});
