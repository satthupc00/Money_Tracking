import React from 'react';

// Logo app: cột tăng trưởng xanh + đồng xu đỏ nổi khối có mũi tên đi lên
export default function Logo({ className, size }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <radialGradient id="lgCoin" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#FF8A8C" />
          <stop offset=".55" stopColor="#E5383B" />
          <stop offset="1" stopColor="#9E1518" />
        </radialGradient>
        <linearGradient id="lgSide" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8E1215" />
          <stop offset="1" stopColor="#5E0A0C" />
        </linearGradient>
        <linearGradient id="lgBar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7FD0FF" />
          <stop offset="1" stopColor="#1747B8" />
        </linearGradient>
      </defs>
      <ellipse cx="256" cy="486" rx="200" ry="20" fill="#000" opacity=".28" />
      <rect x="14" y="250" width="100" height="222" rx="18" fill="url(#lgBar)" />
      <rect x="14" y="250" width="100" height="32" rx="16" fill="#fff" opacity=".28" />
      <rect x="128" y="168" width="100" height="304" rx="18" fill="url(#lgBar)" />
      <rect x="128" y="168" width="100" height="32" rx="16" fill="#fff" opacity=".28" />
      <circle cx="334" cy="292" r="164" fill="url(#lgSide)" />
      <circle cx="334" cy="272" r="164" fill="url(#lgCoin)" />
      <circle cx="334" cy="272" r="124" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="11" />
      <path d="M268 316 L322 260 L356 292 L412 228" fill="none" stroke="#fff" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M376 222 h40 v40" fill="none" stroke="#fff" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="282" cy="176" rx="60" ry="28" fill="#fff" opacity=".45" transform="rotate(-30 282 176)" />
    </svg>
  );
}
