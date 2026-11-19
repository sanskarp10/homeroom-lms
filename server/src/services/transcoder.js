/**
 * FFmpeg wrapper: probes a source video and converts it to adaptive HLS
 * (one playlist per rendition plus a master playlist) and a poster image.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

let cachedBinary = null;
export async function ffmpegBinary() {
  if (cachedBinary) return cachedBinary;
  if (config.ffmpegPath) return (cachedBinary = config.ffmpegPath);
  try {
    const mod = await import('ffmpeg-static');
    const bundled = mod.default;
    if (bundled && fs.existsSync(bundled)) return (cachedBinary = bundled);
  } catch {
    /* fall through to PATH */
  }
  return (cachedBinary = 'ffmpeg');
}

function run(args, { onStdout } = {}) {
  return new Promise(async (resolve, reject) => {
    const bin = await ffmpegBinary();
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stdout.on('data', (d) => onStdout?.(d.toString()));
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });
    child.on('error', (err) =>
      reject(new Error(err.code === 'ENOENT' ? `FFmpeg was not found (${bin}). Set FFMPEG_PATH in server/.env.` : err.message))
    );
    child.on('close', (code) => resolve({ code, stderr }));
  });
}

export async function ffmpegVersion() {
  try {
    const { stderr, code } = await run(['-version']);
    return code === 0 || stderr ? { ok: true, path: await ffmpegBinary() } : { ok: false };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Read duration, frame size and audio presence from the ffmpeg banner. */
export async function probe(input) {
  const { stderr } = await run(['-hide_banner', '-i', input]);
  const dur = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const video = stderr.match(/Stream #[^\n]*Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/);
  if (!video) throw new Error('This file has no video track we can read. Upload an MP4, MOV, MKV or WebM file.');
  let width = Number(video[1]);
  let height = Number(video[2]);
  if (/rotation of -?(90|270)/.test(stderr)) [width, height] = [height, width]; // phone footage
  return {
    duration: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0,
    width,
    height,
    hasAudio: /Stream #[^\n]*Audio:/.test(stderr),
  };
}

const LADDER = [
  { height: 360, video: '800k', maxrate: '856k', bufsize: '1200k', audio: '96k', bandwidth: 1000000 },
  { height: 720, video: '2800k', maxrate: '2996k', bufsize: '4200k', audio: '128k', bandwidth: 3200000 },
  { height: 1080, video: '5000k', maxrate: '5350k', bufsize: '7500k', audio: '160k', bandwidth: 5600000 },
];
const even = (n) => Math.max(2, Math.round(n / 2) * 2);

export function pickRenditions(sourceHeight, maxHeight = 1080) {
  const fits = LADDER.filter((r) => r.height <= sourceHeight * 1.1 && r.height <= maxHeight);
  // Never upscale: tiny sources get a single rendition at their own size.
  return fits.length ? fits : [{ ...LADDER[0], height: even(Math.min(sourceHeight, LADDER[0].height)) }];
}

/**
 * Transcode `input` into `outDir`:
 *   master.m3u8, poster.jpg, v360/index.m3u8 + segments, v720/..., v1080/...
 * onProgress receives 0..100.
 */
export async function transcodeToHls(input, outDir, { onProgress, maxHeight } = {}) {
  const info = await probe(input);
  const renditions = pickRenditions(info.height, maxHeight);
  await fsp.rm(outDir, { recursive: true, force: true });
  await fsp.mkdir(outDir, { recursive: true });

  const master = ['#EXTM3U', '#EXT-X-VERSION:3'];
  for (let i = 0; i < renditions.length; i++) {
    const r = renditions[i];
    const dir = path.join(outDir, `v${r.height}`);
    await fsp.mkdir(dir, { recursive: true });
    const args = [
      '-y', '-hide_banner', '-loglevel', 'error', '-nostats', '-progress', 'pipe:1',
      '-i', input,
      '-map', '0:v:0',
      ...(info.hasAudio ? ['-map', '0:a:0'] : []),
      '-vf', `scale=-2:${r.height}`,
      '-c:v', 'libx264', '-preset', config.ffmpegPreset, '-profile:v', 'main', '-pix_fmt', 'yuv420p',
      '-b:v', r.video, '-maxrate', r.maxrate, '-bufsize', r.bufsize,
      // A keyframe every 2 seconds regardless of frame rate, so segments cut cleanly.
      '-force_key_frames', 'expr:gte(t,n_forced*2)', '-sc_threshold', '0',
      ...(info.hasAudio ? ['-c:a', 'aac', '-b:a', r.audio, '-ac', '2', '-ar', '48000'] : []),
      '-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'vod', '-hls_flags', 'independent_segments',
      '-hls_segment_filename', path.join(dir, 'seg_%04d.ts'),
      path.join(dir, 'index.m3u8'),
    ];
    const { code, stderr } = await run(args, {
      onStdout: (chunk) => {
        const m = [...chunk.matchAll(/out_time_(?:us|ms)=(\d+)/g)].pop();
        if (m && info.duration > 0 && onProgress) {
          const fraction = Math.min(1, Number(m[1]) / 1e6 / info.duration);
          onProgress(Math.min(99, Math.round(((i + fraction) / renditions.length) * 100)));
        }
      },
    });
    if (code !== 0) throw new Error(`FFmpeg failed on the ${r.height}p rendition: ${lastLine(stderr)}`);
    const width = even((info.width * r.height) / info.height);
    master.push(`#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${width}x${r.height}`, `v${r.height}/index.m3u8`);
  }
  await fsp.writeFile(path.join(outDir, 'master.m3u8'), master.join('\n') + '\n');

  const posterAt = Math.max(0, Math.min(3, info.duration / 3));
  const poster = await run([
    '-y', '-hide_banner', '-loglevel', 'error', '-ss', String(posterAt), '-i', input,
    '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '4', path.join(outDir, 'poster.jpg'),
  ]);
  const hasPoster = poster.code === 0 && fs.existsSync(path.join(outDir, 'poster.jpg'));

  onProgress?.(100);
  return { ...info, renditions: renditions.map((r) => r.height), hasPoster };
}

const lastLine = (text) => text.trim().split('\n').filter(Boolean).pop() || 'unknown error';
