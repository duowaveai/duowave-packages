import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Shot } from '../lib/stage';
import { CATALOG, SetView } from './index';
import type { SetState } from './types';

// Кадр одной декорации (композиция `set`): состояние и ракурс — как у плана серии данными. Для проверки декорации,
// превью в каталоге, «посмотри сам» у режиссёра. inputProps { id, state?, spot?, fx?, fy?, s?, cy?, t? }.

export type SetPreviewProps = { id: string; state?: SetState; spot?: string; fx?: number; fy?: number; s?: number; cy?: number; t?: number };

export const SetPreview: React.FC<SetPreviewProps> = ({ id, state, spot, fx, fy, s, cy, t = 1 }) => {
  const at = spot ? CATALOG[id]?.spots[spot] : undefined;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Shot fx={fx ?? at?.fx ?? 540} fy={fy ?? at?.fy ?? 960} s={Math.max(1, s ?? at?.s ?? 1)} cy={cy ?? 960}>
        <SetView id={id} state={state} t={t} />
      </Shot>
    </AbsoluteFill>
  );
};
