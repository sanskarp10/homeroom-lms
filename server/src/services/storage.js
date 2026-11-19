/**
 * Media storage with two drivers behind one interface:
 *   local - files live in server/storage/media and are served from /media
 *   s3    - files live in S3 and are delivered through CloudFront
 * The database only stores keys; URLs are built on read with urlFor().
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { config } from '../config.js';

export const mediaRoot = path.join(config.storageRoot, 'media');
export const tmpRoot = path.join(config.storageRoot, 'tmp');
fs.mkdirSync(mediaRoot, { recursive: true });
fs.mkdirSync(tmpRoot, { recursive: true });

const isS3 = () => config.storageDriver === 's3';

const CONTENT_TYPES = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
export const contentTypeFor = (file) => CONTENT_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';

let s3Client = null;
async function s3() {
  if (!s3Client) {
    const { S3Client } = await import('@aws-sdk/client-s3');
    const { accessKeyId, secretAccessKey, region } = config.aws;
    s3Client = new S3Client({
      region,
      // Without explicit keys the SDK uses its default chain (instance role, SSO, ...).
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }
  return s3Client;
}

/** Public URL for a stored key. Local URLs are relative so they work behind any host. */
export function urlFor(key) {
  if (!key) return '';
  return isS3() ? `https://${config.aws.cloudfrontDomain}/${key}` : `/media/${key}`;
}

export async function putFile(localPath, key) {
  if (isS3()) {
    const { Upload } = await import('@aws-sdk/lib-storage');
    await new Upload({
      client: await s3(),
      params: {
        Bucket: config.aws.bucket,
        Key: key,
        Body: fs.createReadStream(localPath),
        ContentType: contentTypeFor(key),
        CacheControl: 'public, max-age=31536000, immutable',
      },
    }).done();
    return key;
  }
  const dest = path.join(mediaRoot, key);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.copyFile(localPath, dest);
  return key;
}

/** Upload every file below localDir under the given key prefix. */
export async function putDir(localDir, prefix) {
  const files = await walk(localDir);
  if (isS3()) {
    // A few uploads at a time keeps memory flat for long videos.
    const pool = 6;
    let i = 0;
    await Promise.all(
      Array.from({ length: pool }, async () => {
        while (i < files.length) {
          const file = files[i++];
          await putFile(file, `${prefix}/${path.relative(localDir, file).split(path.sep).join('/')}`);
        }
      })
    );
    return files.length;
  }
  const dest = path.join(mediaRoot, prefix);
  await fsp.rm(dest, { recursive: true, force: true });
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.cp(localDir, dest, { recursive: true });
  return files.length;
}

/** Copy a stored object to a local file (the worker uses this for sources kept in S3). */
export async function fetchToFile(key, dest) {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  if (isS3()) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const res = await (await s3()).send(new GetObjectCommand({ Bucket: config.aws.bucket, Key: key }));
    await pipeline(res.Body, fs.createWriteStream(dest));
    return dest;
  }
  await fsp.copyFile(path.join(mediaRoot, key), dest);
  return dest;
}

export async function removePrefix(prefix) {
  if (!prefix) return;
  if (isS3()) {
    const { ListObjectsV2Command, DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
    const client = await s3();
    let token;
    do {
      const page = await client.send(
        new ListObjectsV2Command({ Bucket: config.aws.bucket, Prefix: prefix, ContinuationToken: token })
      );
      const objects = (page.Contents || []).map((o) => ({ Key: o.Key }));
      if (objects.length) {
        await client.send(new DeleteObjectsCommand({ Bucket: config.aws.bucket, Delete: { Objects: objects } }));
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return;
  }
  await fsp.rm(path.join(mediaRoot, prefix), { recursive: true, force: true });
}

/** Quick write/read/delete round trip, used by /api/health?deep=1 and `npm run doctor`. */
export async function selfTest() {
  const key = `healthchecks/${Date.now()}.txt`;
  const tmp = path.join(tmpRoot, `health-${Date.now()}.txt`);
  await fsp.writeFile(tmp, 'ok');
  try {
    await putFile(tmp, key);
    await removePrefix(key);
    return { ok: true, driver: config.storageDriver };
  } catch (err) {
    return { ok: false, driver: config.storageDriver, error: err.message };
  } finally {
    await fsp.rm(tmp, { force: true });
  }
}

async function walk(dir) {
  const out = [];
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}
