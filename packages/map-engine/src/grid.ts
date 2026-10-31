export interface GridOptions { enabled: boolean; widthKm: number; heightKm: number }
export interface GridLine { from: [number, number]; to: [number, number] }
export interface GridView { west: number; east: number; south: number; north: number; pixelsPerDegree: number }
export interface GridStats { widthKm: number; heightKm: number; multiplier: number; visibleTiles: number }
export const DEFAULT_GRID: GridOptions = { enabled: true, widthKm: 1, heightKm: 1 };
export function validateGrid(value: GridOptions): GridOptions {
  if (typeof value.enabled !== 'boolean' || ![value.widthKm, value.heightKm].every(n => Number.isFinite(n) && n >= 0.1 && n <= 10000)) throw new Error('Dimensions de tuile : 0,1 à 10 000 km.');
  return { ...value };
}
/** Les méridiens sont continus : la largeur kilométrique est nominale à l’équateur
 * et diminue avec le cosinus de la latitude. Les cases aux bords peuvent être partielles. */
export function visibleGrid(options: GridOptions, radiusKm: number, view: GridView): { lines: GridLine[]; stats: GridStats } {
  validateGrid(options);
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || !Number.isFinite(view.pixelsPerDegree) || view.pixelsPerDegree <= 0 || ![view.west,view.east,view.south,view.north].every(Number.isFinite)) throw new Error('Vue géographique invalide.');
  const kmPerDegree = radiusKm * Math.PI / 180;
  const minimumPixels = Math.min(options.widthKm, options.heightKm) / kmPerDegree * view.pixelsPerDegree;
  if (!Number.isFinite(minimumPixels) || minimumPixels <= 0) throw new Error('Échelle géographique invalide.');
  const multiplier = 2 ** Math.max(0, Math.ceil(Math.log2(48 / minimumPixels)));
  const widthKm = options.widthKm * multiplier; const heightKm = options.heightKm * multiplier;
  const stats = { widthKm, heightKm, multiplier, visibleTiles: 0 };
  const lines: GridLine[] = [];
  const west = Math.max(-180,view.west); const east = Math.min(180,view.east);
  const south = Math.max(-90,view.south); const north = Math.min(90,view.north);
  if (!options.enabled || west >= east || south >= north) return { lines, stats };
  const rowDegrees = Math.min(180, heightKm / kmPerDegree);
  const columnDegrees = Math.min(360, widthKm / kmPerDegree);
  const rowCount = Math.ceil(180 / rowDegrees); const columnCount = Math.ceil(360 / columnDegrees);
  const firstRow = Math.max(0, Math.floor((south + 90) / rowDegrees));
  const lastRow = Math.min(rowCount, Math.ceil((north + 90) / rowDegrees));
  const firstColumn = Math.max(0, Math.floor((west + 180) / columnDegrees));
  const lastColumn = Math.min(columnCount, Math.ceil((east + 180) / columnDegrees));
  stats.visibleTiles = Math.max(0,lastRow-firstRow) * Math.max(0,lastColumn-firstColumn);
  // Les mêmes positions sont utilisées pour toute latitude et toutes les vues.
  for (let row = firstRow; row <= lastRow && lines.length < 2048; row++) {
    const latitude = Math.min(90, -90 + row * rowDegrees);
    if (latitude >= south && latitude <= north) lines.push({ from: [west,latitude], to: [east,latitude] });
  }
  for (let col = firstColumn; col <= lastColumn && lines.length < 4096; col++) {
    const longitude = Math.min(180, -180 + col * columnDegrees);
    if (longitude >= west && longitude <= east) lines.push({ from: [longitude,south], to: [longitude,north] });
  }
  return { lines, stats };
}
