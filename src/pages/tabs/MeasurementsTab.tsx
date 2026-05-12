import { useState } from 'react';
import { Ruler, Plus, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { C } from '../../theme';

interface MeasurementsTabProps {
  opportunityName: string;
  dropboxAuthRequired: boolean;
}

interface MeasurementEntry {
  id: string;
  label: string;
  value: number;
  timestamp: string;
}

type SaveStatus = 'idle' | 'saving' | 'done' | 'error';

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
      <Ruler size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
      <div style={{ fontSize: 13 }}>No measurements recorded yet</div>
    </div>
  );
}

export function MeasurementsTab({ opportunityName, dropboxAuthRequired }: MeasurementsTabProps) {
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementEntry[]>([]);

  const numVal = parseFloat(value);
  const canAdd = label.trim().length > 0 && value.trim().length > 0 && !isNaN(numVal) && saveStatus !== 'saving';

  const handleAdd = async () => {
    if (!canAdd) return;
    const ts = new Date().toISOString();
    const row = `| ${label.trim()} | ${numVal.toFixed(2)} ft | ${ts} |`;
    const root = (import.meta.env.VITE_DROPBOX_ROOT_FOLDER ?? 'Current Opportunities').replace(/^\//, '').replace(/\/$/, '');
    const filePath = `/${root}/${opportunityName}/measurements.md`;

    setSaveStatus('saving');
    setSaveError(null);

    try {
      const res = await fetch('/api/dropbox/append-md', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, text: row }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string; detail?: string };
        throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`);
      }
      setMeasurements((prev) => [...prev, { id: `${Date.now()}`, label: label.trim(), value: numVal, timestamp: ts }]);
      setLabel('');
      setValue('');
      setSaveStatus('done');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
      setSaveStatus('error');
    }
  };

  if (dropboxAuthRequired) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.muted }}>
        <p style={{ fontSize: 14, marginBottom: 16 }}>
          Connect Dropbox to record and sync measurements.
        </p>
        <a
          href="/api/auth/dropbox/login"
          style={{
            display: 'inline-block',
            background: C.red,
            color: C.white,
            padding: '10px 20px',
            borderRadius: 4,
            fontWeight: 700,
            fontSize: 13,
            textDecoration: 'none',
            letterSpacing: 0.5,
          }}
        >
          Connect Dropbox
        </a>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Input form */}
      <div
        style={{
          background: C.white,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 700,
              color: C.muted,
              marginBottom: 4,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Trench depth, Wall width…"
            style={{
              width: '100%',
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: '10px 12px',
              fontSize: 14,
              color: C.text,
              background: C.offwhite,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 700,
              color: C.muted,
              marginBottom: 4,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            Value (ft)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            style={{
              width: '100%',
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: '10px 12px',
              fontSize: 14,
              color: C.text,
              background: C.offwhite,
              outline: 'none',
            }}
          />
        </div>

        {saveError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: C.red,
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            <AlertCircle size={14} />
            {saveError}
          </div>
        )}

        <button
          onClick={handleAdd}
          disabled={!canAdd}
          style={{
            width: '100%',
            background: canAdd ? C.red : C.border,
            color: C.white,
            padding: '12px 16px',
            borderRadius: 4,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 0.5,
            border: 'none',
            cursor: canAdd ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {saveStatus === 'saving' && (
            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
          )}
          {saveStatus === 'done' && <CheckCircle size={16} />}
          {(saveStatus === 'idle' || saveStatus === 'error') && <Plus size={16} />}
          {saveStatus === 'saving' ? 'SAVING…' : saveStatus === 'done' ? 'SAVED' : 'ADD MEASUREMENT'}
        </button>
      </div>

      {/* Measurement list */}
      {measurements.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...measurements].reverse().map((m) => (
            <div
              key={m.id}
              style={{
                background: C.white,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{m.label}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.navy }}>
                {m.value.toFixed(2)} ft
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
