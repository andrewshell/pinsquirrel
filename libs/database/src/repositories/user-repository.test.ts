import { describe, it, expect } from "vitest";
import { DrizzleUserRepository } from "./user-repository.js";

describe("DrizzleUserRepository", () => {
  it("should be instantiable", () => {
    const repository = new DrizzleUserRepository();
    expect(repository).toBeInstanceOf(DrizzleUserRepository);
  });

  // Note: These would be integration tests requiring a test database
  // For now, we're just testing that the class can be instantiated
});
