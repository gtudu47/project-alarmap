import type { MapObject } from '@alarmap/map-model';
export interface PointChange { before: MapObject | null; after: MapObject | null }
export interface LayerMove { type: 'move-layer'; objectId: string; beforeLayerId: string; afterLayerId: string }
export type HistoryChange = PointChange | LayerMove;
/** Historique local ; avancer le curseur uniquement après la sauvegarde serveur. */
export class PointHistory {
  private entries: HistoryChange[] = [];
  private cursor = 0;
  get canUndo(): boolean { return this.cursor > 0; }
  get canRedo(): boolean { return this.cursor < this.entries.length; }
  record(change: HistoryChange): void {
    this.entries = this.entries.slice(0, this.cursor);
    this.entries.push(structuredClone(change));
    if (this.entries.length > 50) this.entries.shift();
    this.cursor = this.entries.length;
  }
  peek(direction: 'undo' | 'redo'): HistoryChange | undefined {
    const entry = this.entries[direction === 'undo' ? this.cursor - 1 : this.cursor];
    return entry ? structuredClone(entry) : undefined;
  }
  accept(direction: 'undo' | 'redo'): void {
    if (direction === 'undo' && this.canUndo) this.cursor--;
    if (direction === 'redo' && this.canRedo) this.cursor++;
  }
  clear(): void { this.entries = []; this.cursor = 0; }
}
