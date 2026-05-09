// Декоративные SVG-стикеры в готическо-милом стиле
import { CSSProperties } from 'react';

interface StickerProps {
  className?: string;
  style?: CSSProperties;
}

export function BatSticker({ className = '', style }: StickerProps) {
  return (
    <span className={`sticker ${className}`} style={style} aria-hidden>
      <svg width="42" height="32" viewBox="0 0 42 32" fill="none">
        <path
          d="M21 6c2-3 6-4 9-2 0 3-1 5-3 6 4 0 7 2 9 5-3 1-6 1-8 0 1 2 1 4 0 6-3-1-5-3-6-5-1 2-3 4-6 5-1-2-1-4 0-6-2 1-5 1-8 0 2-3 5-5 9-5-2-1-3-3-3-6 3-2 7-1 9 2 1 1 1 1 0 0z"
          fill="#1d1014"
          stroke="#c8a96a"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <circle cx="18" cy="11" r="0.9" fill="#c0233a" />
        <circle cx="24" cy="11" r="0.9" fill="#c0233a" />
      </svg>
    </span>
  );
}

export function BloodDropSticker({ className = '', style }: StickerProps) {
  return (
    <span className={`sticker sticker-2 ${className}`} style={style} aria-hidden>
      <svg width="22" height="30" viewBox="0 0 22 30" fill="none">
        <path
          d="M11 2 C 5 12, 2 17, 2 22 a9 8 0 0 0 18 0 c0-5 -3-10 -9-20z"
          fill="#8a0e1a"
          stroke="#c8a96a"
          strokeWidth="1.1"
        />
        <ellipse cx="8" cy="20" rx="2" ry="3" fill="#d8536e" opacity="0.6" />
      </svg>
    </span>
  );
}

export function RoseSticker({ className = '', style }: StickerProps) {
  return (
    <span className={`sticker sticker-3 ${className}`} style={style} aria-hidden>
      <svg width="32" height="34" viewBox="0 0 32 34" fill="none">
        <circle cx="16" cy="14" r="7" fill="#8a0e1a" stroke="#c8a96a" strokeWidth="1" />
        <circle cx="16" cy="14" r="4" fill="#c0233a" />
        <circle cx="16" cy="14" r="1.5" fill="#1d1014" />
        <path d="M16 21 Q 14 28 8 30" stroke="#3a5d2a" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M16 21 Q 18 28 24 30" stroke="#3a5d2a" strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="10" cy="27" rx="3" ry="1.5" fill="#3a5d2a" transform="rotate(-30 10 27)" />
      </svg>
    </span>
  );
}

export function MoonSticker({ className = '', style }: StickerProps) {
  return (
    <span className={`sticker ${className}`} style={style} aria-hidden>
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <circle cx="15" cy="15" r="11" fill="#dcd0e3" stroke="#c8a96a" strokeWidth="1" />
        <circle cx="19" cy="13" r="9" fill="#0c0608" />
        <circle cx="11" cy="17" r="0.8" fill="#a89c9b" />
        <circle cx="9"  cy="13" r="0.6" fill="#a89c9b" />
      </svg>
    </span>
  );
}

export function CoffinSticker({ className = '', style }: StickerProps) {
  return (
    <span className={`sticker sticker-2 ${className}`} style={style} aria-hidden>
      <svg width="26" height="34" viewBox="0 0 26 34" fill="none">
        <path d="M6 2 H 20 L 24 10 V 26 L 20 32 H 6 L 2 26 V 10 Z"
              fill="#1d1014" stroke="#c8a96a" strokeWidth="1.2" />
        <path d="M13 8 V 18 M9 13 H 17" stroke="#c8a96a" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}
