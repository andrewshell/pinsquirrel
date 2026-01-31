import type {
  Session,
  CreateSessionData,
  UpdateSessionData,
} from '../entities/session.js'
import type { Repository } from './repository.js'

export interface SessionRepository
  extends Repository<Session, CreateSessionData, UpdateSessionData> {
  findByUserId(userId: string): Promise<Session[]>
  deleteByUserId(userId: string): Promise<boolean>
  deleteExpiredSessions(): Promise<number>
  isValidSession(id: string): Promise<boolean>
}
