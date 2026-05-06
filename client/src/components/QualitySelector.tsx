import React from 'react';
import type { ImageQuality } from '../api';

const OPTIONS: { id: ImageQuality; label: string; latency: string }[] = [
  { id: 'low',    label: 'Low',    latency: '~25s' },
  { id: 'medium', label: 'Medium', latency: '~60s' },
  { id: 'high',   label: 'High',   latency: '~120s' },
  { id: 'auto',   label: 'Auto',   latency: 'model picks' },
];

interface Props {
  value: ImageQuality;
  onChange: (q: ImageQuality) => void;
  label?: string;
  disabled?: boolean;
  compact?: boolean;
}

export default function QualitySelector({ value, onChange, label = 'Quality', disabled, compact }: Props) {
  return (
    <div style={S.wrap}>
      <label style={S.label}>{label}</label>
      <div style={{ ...S.pills, ...(compact ? { gap: 2 } : {}) }}>
        {OPTIONS.map(o => (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.id)}
            title={o.latency}
            style={{
              ...S.pill,
              ...(compact ? S.pillCompact : {}),
              ...(value === o.id ? S.pillActive : {}),
              ...(disabled ? S.pillDisabled : {}),
            }}
          >
            {o.label}
            {!compact && <span style={S.hint}>{o.latency}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, color: '#8888aa', letterSpacing: 1, textTransform: 'uppercase' },
  pills: { display: 'flex', gap: 4, background: '#111128', border: '1px solid #7c4dff20', borderRadius: 8, padding: 4 },
  pill: { background: 'none', border: 'none', borderRadius: 6, color: '#8888aa', cursor: 'pointer', padding: '6px 12px', fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60, transition: 'all 0.15s' },
  pillCompact: { padding: '4px 10px', minWidth: 0 },
  pillActive: { background: '#2a1a5a', color: '#b39dff' },
  pillDisabled: { cursor: 'not-allowed', opacity: 0.5 },
  hint: { fontSize: 9, color: '#7c7ca0', marginTop: 2, fontWeight: 400 },
};
