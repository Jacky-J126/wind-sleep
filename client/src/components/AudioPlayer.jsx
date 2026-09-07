import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const getVolume = () => parseFloat(localStorage.getItem('ws_volume') || '0.8');
// DJ 旁白期间音乐压低到 25%，播完恢复（radio 式 ducking）
const DUCK_RATIO = 0.25;

const AudioPlayer = forwardRef(function AudioPlayer({ track, announceUrl, onPlayError, onTrackEnded }, ref) {
  const announceRef = useRef(null);
  const musicRef = useRef(null);

  // 在用户点击手势内解锁浏览器自动播放（Chrome autoplay policy）。
  useImperativeHandle(ref, () => ({
    unlock() {
      const music = musicRef.current;
      if (!music) return;
      music.muted = true;
      const p = music.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          music.pause();
          music.muted = false;
        }).catch(() => { music.muted = false; });
      }
    },
    stop() {
      const music = musicRef.current;
      const announce = announceRef.current;
      if (music) { music.pause(); music.removeAttribute('src'); }
      if (announce) { announce.pause(); announce.removeAttribute('src'); }
    },
  }));

  const safePlay = (el) => {
    const p = el.play();
    if (p && typeof p.then === 'function') {
      p.catch((err) => {
        console.warn('[AudioPlayer] 播放被阻止或失败:', err && err.message);
        if (onPlayError) onPlayError(err);
      });
    }
  };

  // DJ 旁白：压低音乐音量（ducking）→ 播完恢复并继续音乐。
  useEffect(() => {
    if (!announceUrl) return;
    const announce = announceRef.current;
    const music = musicRef.current;
    const baseVol = getVolume();

    announce.src = announceUrl;
    announce.volume = baseVol;
    if (music) music.volume = baseVol * DUCK_RATIO;
    const onEnded = () => {
      if (music) music.volume = baseVol;
      if (musicRef.current?.src) safePlay(musicRef.current);
    };
    announce.addEventListener('ended', onEnded, { once: true });
    announce.play().catch((err) => {
      console.warn('[AudioPlayer] 旁白播放失败，直接切到音乐:', err && err.message);
      onEnded();
    });
    return () => announce.removeEventListener('ended', onEnded);
  }, [announceUrl]);

  // 音乐源加载；没有旁白时自动播放（旁白期间保持 ducking 音量）。
  useEffect(() => {
    const music = musicRef.current;
    if (!music || !track?.url) return;
    const baseVol = getVolume();
    music.volume = announceUrl ? baseVol * DUCK_RATIO : baseVol;
    if (music.src !== track.url) music.src = track.url;
    if (!announceUrl) safePlay(music);
  }, [track?.url, announceUrl]);

  return (
    <>
      <audio ref={announceRef} style={{ display: 'none' }} playsInline />
      <audio
        ref={musicRef}
        style={{ display: 'none' }}
        preload="auto"
        playsInline
        onEnded={onTrackEnded}
      />
    </>
  );
});

export default AudioPlayer;
