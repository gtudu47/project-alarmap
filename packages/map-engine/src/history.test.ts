import { describe, expect, it } from 'vitest';
import { createDemoWorld } from '@alarmap/map-model';
import { PointHistory } from './history';

describe('historique local des lieux', () => {
  it('ne déplace le curseur qu’après succès et isole les instantanés', () => {
    const history = new PointHistory(); const point = createDemoWorld().objects[0]!;
    history.record({ before: null, after: point }); point.name = 'Changé ensuite';
    expect(history.peek('undo')?.after?.name).toBe('Origine');
    expect(history.canRedo).toBe(false);
    history.accept('undo'); expect(history.canUndo).toBe(false);
    expect(history.peek('redo')?.after?.id).toBe(point.id);
    history.accept('redo'); expect(history.canUndo).toBe(true);
  });
  it('une nouvelle action abandonne le rétablissement et borne la mémoire', () => {
    const history = new PointHistory(); const point = createDemoWorld().objects[0]!;
    for (let index = 0; index < 60; index++) history.record({ before: null, after: { ...point, name: String(index) } });
    for (let index = 0; index < 50; index++) history.accept('undo');
    expect(history.canUndo).toBe(false); expect(history.peek('redo')?.after?.name).toBe('10');
    history.record({ before: null, after: point }); expect(history.canRedo).toBe(false);
    history.clear(); expect(history.canUndo).toBe(false); expect(history.canRedo).toBe(false);
  });
});
