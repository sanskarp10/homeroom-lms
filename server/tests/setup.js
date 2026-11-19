// Runs before every test file, before the app is imported.
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/homeroom_test';
process.env.MONGO_MEMORY_FALLBACK = 'true';
process.env.QUEUE_DRIVER = 'inline';
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_DIR = 'storage-test';
process.env.STRIPE_SECRET_KEY = '';
process.env.JWT_SECRET = 'test-secret';
process.env.PLATFORM_FEE_PERCENT = '20';
process.env.FFMPEG_PRESET = 'ultrafast';
