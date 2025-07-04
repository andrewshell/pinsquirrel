interface Config {
  database: {
    filename: string;
  };
  auth: {
    sessionSecret: string;
    sessionDurationHours: number;
    inviteCode: string;
  };
  app: {
    isDev: boolean;
  };
}

function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

function _getOptionalEnvVar(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

function getOptionalEnvVarNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(
      `Environment variable ${name} must be a valid number, got: ${value}`
    );
  }
  return parsed;
}

export const config: Config = {
  database: {
    filename: getRequiredEnvVar('DB_FILE_NAME'),
  },
  auth: {
    sessionSecret: getRequiredEnvVar('SESSION_SECRET'),
    sessionDurationHours: getOptionalEnvVarNumber(
      'SESSION_DURATION_HOURS',
      168
    ), // 7 days
    inviteCode: getRequiredEnvVar('INVITE_CODE'),
  },
  app: {
    isDev: process.env.NODE_ENV === 'development',
  },
} as const;

// Validate config on module load
if (config.auth.sessionSecret === 'default-secret-change-in-production') {
  if (!config.app.isDev) {
    throw new Error('SESSION_SECRET must be changed in production');
  }
  console.warn(
    '⚠️  Using default SESSION_SECRET in development. Change this in production!'
  );
}

if (config.auth.sessionDurationHours <= 0) {
  throw new Error('SESSION_DURATION_HOURS must be greater than 0');
}

export default config;
