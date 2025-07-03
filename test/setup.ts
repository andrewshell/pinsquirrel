import '@testing-library/jest-dom';

// Set up environment variables for tests
process.env.DB_FILE_NAME = ':memory:';
process.env.SESSION_SECRET = 'test-secret-key-for-testing-only';
process.env.INVITE_CODE = 'test-invite-code';
process.env.NODE_ENV = 'test';
