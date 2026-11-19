/**
 * HLS video player. hls.js is loaded on demand and handles adaptive bitrate;
 * Safari plays HLS natively. Reports playback time so progress can be saved.
 */
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Gauge, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { assetUrl } from '../lib/format.js';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayer({ src, poster, startAt = 0, autoPlay = false, onTime, onEnded, className, title }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const onTimeRef = useRef(onTime);
  const onEndedRef = useRef(onEnded);
  onTimeRef.current = onTime;
  onEndedRef.current = onEnded;
  const [levels, setLevels] = useState([]);
  const [level, setLevel] = useState(-1);
  const [activeHeight, setActiveHeight] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return undefined;
    let cancelled = false;
    let hls;
    const url = assetUrl(src);
    setError('');
    setLevels([]);
    setLevel(-1);

    const seekToStart = () => {
      if (startAt > 1 && Number.isFinite(video.duration) && startAt < video.duration - 3) video.currentTime = startAt;
      if (autoPlay) video.play().catch(() => {});
    };

    // Prefer hls.js wherever Media Source Extensions exist (it gives us the quality menu);
    // fall back to the browser's own HLS support (iPhone Safari).
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) {
        if (!video.canPlayType('application/vnd.apple.mpegurl')) {
          return setError('This browser cannot play streaming video. Try a current version of Chrome, Edge, Firefox or Safari.');
        }
        video.src = url;
        video.addEventListener('loadedmetadata', seekToStart, { once: true });
        return;
      }
      hls = new Hls({ startPosition: startAt > 1 ? startAt : -1, capLevelToPlayerSize: true, maxBufferLength: 30 });
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setLevels(data.levels.map((l, index) => ({ index, height: l.height })).sort((x, y) => y.height - x.height));
        if (autoPlay) video.play().catch(() => {});
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setActiveHeight(hls.levels[data.level]?.height || null));
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else setError('This video could not be played. Reload the page to try again.');
      });
      hls.loadSource(url);
      hls.attachMedia(video);
    }).catch(() => !cancelled && setError('The video player could not be loaded. Check your connection and reload.'));

    let lastReport = 0;
    const report = (force) => {
      const now = Date.now();
      if (!force && now - lastReport < 5000) return;
      lastReport = now;
      if (video.currentTime > 0) onTimeRef.current?.(video.currentTime, video.duration || 0);
    };
    const onTimeUpdate = () => report(false);
    const onPause = () => report(true);
    const ended = () => { report(true); onEndedRef.current?.(); };
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', ended);

    return () => {
      cancelled = true;
      report(true);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', ended);
      video.removeEventListener('loadedmetadata', seekToStart);
      hls?.destroy();
      hlsRef.current = null;
      video.removeAttribute('src');
      video.load();
    };
    // startAt is only read when a new source loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = speed; }, [speed, src]);

  const chooseLevel = (value) => {
    setLevel(value);
    if (hlsRef.current) hlsRef.current.currentLevel = value;
  };

  const select = 'on-board cursor-pointer rounded-md border border-white/15 bg-white/[.06] py-1 pl-2 pr-7 text-xs font-semibold text-white hover:bg-white/10';
  return (
    <div className={clsx('overflow-hidden bg-black', className)}>
      <div className="relative aspect-video w-full bg-black">
        <video ref={videoRef} className="h-full w-full" controls playsInline preload="metadata" poster={poster ? assetUrl(poster) : undefined} aria-label={title} />
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-board-950/90 p-6 text-center text-sm text-white">
            <div><TriangleAlert className="mx-auto mb-2 h-6 w-6 text-pencil" />{error}</div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-3 bg-board-950 px-3 py-2 text-white/70">
        <label className="flex items-center gap-1.5 text-xs">
          <Gauge className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only sm:not-sr-only">Speed</span>
          <select className={select} value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => <option key={s} value={s} className="text-ink">{s}x</option>)}
          </select>
        </label>
        {levels.length > 1 && (
          <label className="flex items-center gap-1.5 text-xs">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only sm:not-sr-only">Quality</span>
            <select className={select} value={level} onChange={(e) => chooseLevel(Number(e.target.value))}>
              <option value={-1} className="text-ink">Auto{level === -1 && activeHeight ? ` (${activeHeight}p)` : ''}</option>
              {levels.map((l) => <option key={l.index} value={l.index} className="text-ink">{l.height}p</option>)}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
