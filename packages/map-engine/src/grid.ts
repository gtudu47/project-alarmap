export interface GridOptions { enabled: boolean; widthKm: number; heightKm: number }
export interface GridLine { from: [number, number]; to: [number, number] }
export interface GridView { west: number; east: number; south: number; north: number; pixelsPerDegree: number }
export interface GridStats { widthKm: number; heightKm: number; multiplier: number; visibleTiles: number }
export const DEFAULT_GRID: GridOptions = { enabled: true, widthKm: 1, heightKm: 1 };
export function validateGrid(value: GridOptions): GridOptions {
  if (typeof value.enabled !== 'boolean' || ![value.widthKm, value.heightKm].every(n => Number.isFinite(n) && n >= 0.1 && n <= 10000)) throw new Error('Dimensions de tuile : 0,1 à 10 000 km.');
  return { ...value };
}
/** Taille est-ouest mesurée sur le parallèle médian de chaque bande.
 * Les cellules coupées aux pôles/à l’antiméridien sont partielles. */
export function visibleGrid(options: GridOptions, radiusKm: number, view: GridView): { lines: GridLine[]; stats: GridStats } {
  validateGrid(options);
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || !Number.isFinite(view.pixelsPerDegree) || view.pixelsPerDegree <= 0 || ![view.west,view.east,view.south,view.north].every(Number.isFinite)) throw new Error('Vue géographique invalide.');
  const kmPerDegree = radiusKm * Math.PI / 180;
  const minimumPixels = Math.min(options.widthKm, options.heightKm) / kmPerDegree * view.pixelsPerDegree;
  const multiplier = 2 ** Math.max(0, Math.ceil(Math.log2(48 / minimumPixels)));
  const widthKm = options.widthKm * multiplier; const heightKm = options.heightKm * multiplier;
  const stats = { widthKm, heightKm, multiplier, visibleTiles: 0 };
  const lines: GridLine[] = [];
  const west = Math.max(-180,view.west); const east = Math.min(180,view.east);
  const south = Math.max(-90,view.south); const north = Math.min(90,view.north);
  if (!options.enabled || west >= east || south >= north) return { lines, stats };
  const rowDegrees = Math.min(180, heightKm / kmPerDegree);
  const start = Math.max(0, Math.floor((south + 90) / rowDegrees));
  const end = Math.ceil((north + 90) / rowDegrees);
  for (let row = start; row < end && lines.length < 4096; row++) {
    const bottom = -90 + row * rowDegrees; const top = Math.min(90,bottom + rowDegrees);
    const middle = (bottom + top) / 2;
    const columnDegrees = Math.min(360, widthKm / (kmPerDegree * Math.max(1e-12, Math.cos(middle * Math.PI / 180))));
    const first = Math.max(0, Math.floor((west + 180) / columnDegrees));
    const last = Math.ceil((east + 180) / columnDegrees);
    if (bottom >= south) lines.push({ from: [west,bottom], to: [east,bottom] });
    if (row === end - 1 && top <= north) lines.push({ from: [west,top], to: [east,top] });
    for (let col = first; col <= last && lines.length < 4096; col++) {
      const longitude = Math.min(180, -180 + col * columnDegrees);
      if (longitude >= west && longitude <= east) lines.push({ from: [longitude,Math.max(bottom,south)], to: [longitude,Math.min(top,north)] });
      if (col < last) stats.visibleTiles++;
    }
  }
  return { lines, stats };
}
