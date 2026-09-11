export type DrumSide = 'bayan' | 'dayan';

// Coordinates are relative to each photographed drum head, not the full image.
export const DRUM_REGIONS = {
  bayan: [
    { bol: 'Ge', voice: 'ge', x: 0.68, y: 0.57 },
    { bol: 'Ke', voice: 'ke', x: 0.5, y: 0.4 },
  ],
  dayan: [
    { bol: 'Na', voice: 'na', x: 0.86, y: 0.72 },
    { bol: 'Tin', voice: 'tin', x: 0.76, y: 0.5 },
    { bol: 'Tun', voice: 'tun', x: 0.5, y: 0.34 },
    { bol: 'Te', voice: 'te', x: 0.5, y: 0.55 },
  ],
} as const;

export function drumBolAt(side: DrumSide, x: number, y: number) {
  const radius = Math.hypot((x - 0.5) * 2, (y - 0.5) * 2);
  if (radius > 1) return null;
  if (side === 'bayan') return radius < 0.32 ? 'Ke' : 'Ge';
  if (radius >= 0.72) return 'Na';
  if (radius >= 0.46) return 'Tin';
  return y < 0.45 ? 'Tun' : 'Te';
}
