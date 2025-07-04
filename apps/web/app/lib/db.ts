import { drizzle } from 'drizzle-orm/libsql';
import config from './config';

const db = drizzle(config.database.filename);

export default { db };
