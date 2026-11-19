const quiet = process.env.NODE_ENV === 'test';
const stamp = () => new Date().toISOString().slice(11, 19);
export const log = {
  info: (...a) => { if (!quiet) console.log(`[${stamp()}]`, ...a); },
  warn: (...a) => { if (!quiet) console.warn(`[${stamp()}] WARN`, ...a); },
  error: (...a) => console.error(`[${stamp()}] ERROR`, ...a),
};
