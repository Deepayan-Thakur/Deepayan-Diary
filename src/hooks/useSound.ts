import { useCallback } from 'react';
import { useAudio } from '../App';

export const useSound = () => {
  const { isMuted } = useAudio();

  const playSound = useCallback((type: 'open' | 'flip' | 'click' | 'hover' | 'imageClick') => {
    if (isMuted) return;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'open') {
      // Soft swelling sound
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(220, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 1.5);
    } else if (type === 'flip') {
      // Authentic real paper turning sound
      const duration = 0.4;
      const bufferSize = Math.floor(audioCtx.sampleRate * duration);
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // Generating brown-ish noise for deeper paper texture
        const white = Math.random() * 2 - 1;
        output[i] = (i === 0 ? white : (output[i - 1] + (0.02 * white)) / 1.02);
      }
      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      // Sweep the filter to simulate paper sliding and flapping
      filter.frequency.setValueAtTime(600, audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(3000, audioCtx.currentTime + 0.1);
      filter.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.3);
      filter.Q.setValueAtTime(1.5, audioCtx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(gainNode);
      
      // Fast attack, staggered decay for "crumple/slide" paper physics
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.8, audioCtx.currentTime + 0.05); // Initial page grab scrape
      gainNode.gain.exponentialRampToValueAtTime(0.05, audioCtx.currentTime + 0.2); // Mid-air flap
      gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      whiteNoise.start();
      whiteNoise.stop(audioCtx.currentTime + duration);
    } else if (type === 'click') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'hover') {
      // Very soft, high-pitched tick for hovering interactables
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.01, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'imageClick') {
      // Snappy pop for clicking images
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
    }
  }, [isMuted]);

  return { playSound };
};
