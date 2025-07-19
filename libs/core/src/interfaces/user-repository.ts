import type { User, CreateUserData, UpdateUserData } from "../entities/user.js";
import type { Repository } from "./repository.js";

export interface UserRepository
  extends Repository<User, CreateUserData, UpdateUserData> {
  findByEmail(email: string): Promise<User | null>;
}
