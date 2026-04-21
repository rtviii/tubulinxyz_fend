export type AuxLayerKind = 'variants' | 'ligand' | 'ptm';

export interface AuxLayerDescriptor {
  kind: AuxLayerKind;
  /** Ligand site id for 'ligand', modification type for 'ptm'; undefined for 'variants'. */
  id?: string;
}

export const toLayerType = (d: AuxLayerDescriptor): string =>
  d.kind === 'variants' ? 'variants' : `${d.kind}:${d.id}`;

export const parseLayerType = (lt: string): AuxLayerDescriptor | null => {
  if (lt === 'variants') return { kind: 'variants' };
  if (lt.startsWith('ligand:')) return { kind: 'ligand', id: lt.slice('ligand:'.length) };
  if (lt.startsWith('ptm:'))    return { kind: 'ptm',    id: lt.slice('ptm:'.length) };
  return null;
};
