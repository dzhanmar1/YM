import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';

interface VolumeControlProps {
  width?: number;
  className?: string;
}

export const VolumeControl = React.memo(function VolumeControl({ width = 86, className = '' }: VolumeControlProps) {
  const { volume, isMuted, setVolume, toggleMute } = usePlayerStore();
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const effectiveVolume = isMuted ? 0 : volume;
  const displayPercent = Math.round(effectiveVolume * 100);

  // Smooth wheel adjustment
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const step = 0.04;
      const delta = e.deltaY < 0 ? step : -step;
      const nextVol = Math.max(0, Math.min(1, volume + delta));
      if (isMuted && nextVol > 0) {
        toggleMute();
      }
      setVolume(Number(nextVol.toFixed(2)));
    },
    [volume, isMuted, setVolume, toggleMute]
  );

  // Position calculation from mouse event
  const updateVolumeFromX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const offsetX = clientX - rect.left;
      const raw = Math.max(0, Math.min(1, offsetX / rect.width));
      const newVol = Number(raw.toFixed(2));
      if (isMuted && newVol > 0) {
        toggleMute();
      }
      setVolume(newVol);
    },
    [isMuted, setVolume, toggleMute]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateVolumeFromX(e.clientX);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateVolumeFromX(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, updateVolumeFromX]);

  // Choose appropriate volume icon
  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX size={15} />;
    if (volume < 0.45) return <Volume1 size={15} />;
    return <Volume2 size={15} />;
  };

  return (
    <div
      className={className}
      onWheel={handleWheel}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        userSelect: 'none',
        position: 'relative',
      }}
    >
      {/* Mute / Unmute Button */}
      <button
        onClick={toggleMute}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isMuted ? 'var(--text-muted)' : isHovered ? '#ffffff' : 'var(--text-secondary)',
          transition: 'color 0.15s ease',
        }}
        title={isMuted ? 'Включить звук' : 'Заглушить звук (Mute)'}
      >
        {getVolumeIcon()}
      </button>

      {/* Interactive Track Area */}
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        style={{
          width,
          height: 24, // Generous hitbox for easy clicking & dragging
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        {/* Background Track Rail */}
        <div
          style={{
            width: '100%',
            height: isHovered || isDragging ? 5 : 3.5,
            backgroundColor: '#202020',
            border: '1px solid #2c2c2c',
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden',
            transition: 'height 0.12s ease',
          }}
        >
          {/* Active Filled Track */}
          <div
            style={{
              width: `${displayPercent}%`,
              height: '100%',
              backgroundColor: isMuted ? '#555555' : '#ffffff',
              boxShadow: isHovered && !isMuted ? '0 0 8px rgba(255, 255, 255, 0.4)' : 'none',
              transition: isDragging ? 'none' : 'width 0.08s ease',
            }}
          />
        </div>

        {/* Tactile Thumb Indicator */}
        <div
          style={{
            position: 'absolute',
            left: `${displayPercent}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: isHovered || isDragging ? 11 : 7,
            height: isHovered || isDragging ? 11 : 7,
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 6px rgba(255,255,255,0.6)',
            pointerEvents: 'none',
            opacity: isHovered || isDragging ? 1 : 0.85,
            transition: isDragging
              ? 'none'
              : 'left 0.08s ease, width 0.12s ease, height 0.12s ease, opacity 0.12s ease',
          }}
        />
      </div>

      {/* Percentage Readout Tooltip (on hover or dragging) */}
      <div
        style={{
          minWidth: 28,
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          color: isMuted ? '#666666' : isHovered || isDragging ? '#ffffff' : '#888888',
          letterSpacing: '-0.02em',
          transition: 'color 0.15s ease',
          textAlign: 'right',
        }}
      >
        {isMuted ? 'MUT' : `${displayPercent}%`}
      </div>
    </div>
  );
});
