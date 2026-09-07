import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const getVolume = () => parseFloat(localStorage.getItem('ws_volume') || '0.8');

const AudioPlayer = forwardRef(function AudioPlayer({ track, announceUrl, onPlayError }, ref) {
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

  // Speak the DJ line first, then start the music when it ends.
  useEffect(() => {
    if (!announceUrl) return;
    const announce = announceRef.current;
    const music = musicRef.current;
    if (music) music.pause();

    announce.src = announceUrl;
    announce.volume = getVolume();
    const onEnded = () => {
      if (musicRef.current?.src) safePlay(musicRef.current);
    };
    announce.addEventListener('ended', onEnded, { once: true });
    announce.play().catch((err) => {
      console.warn('[AudioPlayer] 旁白播放失败，直接切到音乐:', err && err.message);
      onEnded();
    });
    return () => announce.removeEventListener('ended', onEnded);
  }, [announceUrl]);

  // Load the music source; auto-play only when there's no pending announcement.
  useEffect(() => {
    const music = musicRef.current;
    if (!music || !track?.url) return;
    music.volume = getVolume();
    if (music.src !== track.url) music.src = track.url;
    if (!announceUrl) safePlay(music);
  }, [track?.url, announceUrl]);

  return (
    <>
      <audio ref={announceRef} style={{ display: 'none' }} playsInline />
      <audio ref={musicRef} style={{ display: 'none' }} preload="auto" playsInline />
    </>
  );
});

export default AudioPlayer;
