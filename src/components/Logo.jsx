import React from 'react';
import iconUrl from '../assets/icon.png';

// Logo app: chiếc ví nhỏ ôm đồng xu, có mầm cây
export default function Logo({ className, size }) {
  return <img className={className} src={iconUrl} width={size} height={size} alt="" draggable="false" style={{ objectFit: 'contain' }} />;
}
