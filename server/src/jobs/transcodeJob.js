import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Lesson } from '../models/index.js';
import { transcodeToHls } from '../services/transcoder.js';
import { putDir, fetchToFile, removePrefix, tmpRoot } from '../services/storage.js';
import { recalcCourse } from '../services/courseStats.js';
import { log } from '../utils/log.js';

/**
 * Job payload: { lessonId, assetId, inputPath?, sourceKey?, keepSource? }
 * inputPath is the upload on local disk; sourceKey is the same file in storage
 * (used when the worker runs on another machine).
 */
export async function processTranscode(data, reportProgress) {
  const { lessonId, assetId } = data;
  const lesson = await Lesson.findById(lessonId);
  if (!lesson || lesson.video?.assetId !== assetId) {
    log.warn(`Skipping transcode for ${lessonId}: the lesson changed or was deleted.`);
    return { skipped: true };
  }

  const workDir = path.join(tmpRoot, `hls-${assetId}`);
  let input = data.inputPath;
  let fetched = false;
  const setVideo = (fields) =>
    Lesson.updateOne({ _id: lessonId, 'video.assetId': assetId }, { $set: prefix(fields) });

  try {
    await setVideo({ status: 'processing', progress: 0, error: '' });
    if (!input || !fs.existsSync(input)) {
      if (!data.sourceKey) throw new Error('The uploaded source file is missing.');
      input = path.join(tmpRoot, `src-${assetId}${path.extname(data.sourceKey)}`);
      await fetchToFile(data.sourceKey, input);
      fetched = true;
    }

    let lastWrite = 0;
    const result = await transcodeToHls(input, workDir, {
      onProgress: (p) => {
        const now = Date.now();
        if (now - lastWrite < 1000 && p < 100) return;
        lastWrite = now;
        setVideo({ progress: Math.min(p, 99) }).catch(() => {});
        reportProgress?.(p)?.catch?.(() => {});
      },
    });

    const prefixKey = `videos/${assetId}`;
    await putDir(workDir, prefixKey);
    await setVideo({
      status: 'ready',
      progress: 100,
      hlsKey: `${prefixKey}/master.m3u8`,
      posterKey: result.hasPoster ? `${prefixKey}/poster.jpg` : '',
      duration: Math.round(result.duration),
      renditions: result.renditions,
      error: '',
    });
    await recalcCourse(lesson.course);
    log.info(`Lesson "${lesson.title}" is ready to stream (${result.renditions.map((r) => `${r}p`).join(', ')})`);
    return { ok: true, renditions: result.renditions, duration: result.duration };
  } catch (err) {
    await setVideo({ status: 'failed', error: String(err.message).slice(0, 500) });
    throw err;
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
    if (!data.keepSource) {
      if (input) await fsp.rm(input, { force: true }).catch(() => {});
      if (data.sourceKey) await removePrefix(data.sourceKey).catch(() => {});
    } else if (fetched) {
      await fsp.rm(input, { force: true }).catch(() => {});
    }
  }
}

const prefix = (fields) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [`video.${k}`, v]));
