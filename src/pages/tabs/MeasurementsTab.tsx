import { useCallback, useEffect, useState } from 'react';
import { Ruler, Plus, CheckCircle, AlertCircle, Loader, Trash2, RefreshCw } from 'lucide-react';
import { C } from '../../theme';

interface MeasurementsTabProps {
  opportunityName: string;
  dropboxAuthRequired: boolean;
  onAuthError?: () => void;
}

interface MeasurementEntry {
  id: string;
  label: string;
  value: number;
  timestamp: string;
}

type SaveStatus = 'idle' | 'saving' | 'done' | 'error';

// ─── Markdown helpers ─────────────────────────────────────────────────────────

function parseMdTable(content: string): MeasurementEntry[] {
  return content
    .split('\n')
    .filter((line) => /^\|/.test(line) && !/---/.test(line) && !/Label/.test(line))
    .map((line) => {
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length < 3) return null;
      const [label, valueStr, timestamp] = cells as [string, string, string];
      const value = parseFloat(valueStr);
      if (!label || isNaN(value) || !timestamp) return null;
      return { id: timestamp, label, value, timestamp };
    })
    .filter((m): m is MeasurementEntry => m !== null);
}

function buildMdContent(opportunityName: string, rows: MeasurementEntry[]): string {
  const safeName = opportunityName.replace(/\//g, '-');
  const heading = `# Measurements — ${safeName}\n\n`;
  if (rows.length === 0) return heading;
  const tableHeader = '| Label | Value | Timestamp |\n| --- | --- | --- |';
  const dataRows = rows.map((r) => `| ${r.label} | ${r.value.toFixed(2)} ft | ${r.timestamp} |`).join('\n');
  return heading + tableHeader + '\n' + dataRows;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
      <Ruler size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
      <div style={{ fontSize: 13 }}>No measurements recorded yet</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MeasurementsTab({ opportunityName, dropboxAuthRequired, onAuthError }: MeasurementsTabProps) {
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // ── Fetch existing measurements on mount ──────────────────────────────────

  const fetchMeasurements = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ opportunityName, fileType: 'measurements' });
      const res = await fetch(`/api/dropbox/file?${params}`);
      if (res.status === 401) { onAuthError?.(); return; }
      if (res.status === 404) {
        setMeasurements([]);
        return;
      }
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { content: string };
      setMeasurements(parseMdTable(data.content));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [opportunityName, onAuthError]);

  useEffect(() => {
    if (!dropboxAuthRequired) fetchMeasurements();
    else setLoading(false);
  }, [fetchMeasurements, dropboxAuthRequired]);

  // ── Add a measurement ─────────────────────────────────────────────────────

  const numVal = parseFloat(value);
  const canAdd = label.trim().length > 0 && value.trim().length > 0 && !isNaN(numVal) && saveStatus !== 'saving';

  const handleAdd = async () => {
    if (!canAdd) return;
    const ts = new Date().toISOString();
    const row = `| ${label.trim()} | ${numVal.toFixed(2)} ft | ${ts} |`;

    setSaveStatus('saving');
    setSaveError(null);

    try {
      const res = await fetch('/api/dropbox/append-md', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityName, fileType: 'measurements', text: row }),
      });
      if (res.status === 401) { onAuthError?.(); throw new Error('Session expired — reconnect Dropbox'); }
      if (!res.ok) {
        const body = await res.json() as { error?: string; detail?: string };
        throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`);
      }
      const entry: MeasurementEntry = { id: ts, label: label.trim(), value: numVal, timestamp: ts };
      setMeasurements((prev) => [...prev, entry]);
      setLabel('');
      setValue('');
      setSaveStatus('done');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
      setSaveStatus('error');
    }
  };

  // ── Delete a measurement ──────────────────────────────────────────────────

  const handleDelete = useCallback(async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    const updated = measurements.filter((m) => m.id !== id);
    const content = buildMdContent(opportunityName, updated);

    try {
      const params = new URLSearchParams({ opportunityName, fileType: 'measurements' });
      const res = await fetch(`/api/dropbox/file?${params}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.status === 401) { onAuthError?.(); throw new Error('Session expired — reconnect Dropbox'); }
      if (!res.ok) {
        const body = await res.json() as { error?: string; detail?: string };
        throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`);
      }
      setMeasurements(updated);
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }, [measurements, opportunityName, onAuthError]);

  // ── Auth gate ─────────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

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

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: 13 }}>
          Loading measurements…
        </div>
      )}

      {/* Load error */}
      {loadError && !loading && (
        <div
          style={{
            background: C.cream,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            padding: 12,
            marginBottom: 12,
            fontSize: 13,
            color: C.red,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Could not load measurements: {loadError}</span>
          <button
            onClick={fetchMeasurements}
            style={{
              background: C.navy,
              color: C.white,
              padding: '6px 12px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Measurement list */}
      {!loading && !loadError && measurements.length === 0 && <EmptyState />}

      {!loading && measurements.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...measurements].reverse().map((m) => {
            const isDeleting = deletingIds.has(m.id);
            return (
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
                  opacity: isDeleting ? 0.5 : 1,
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.navy }}>
                    {m.value.toFixed(2)} ft
                  </div>
                  <button
                    onClick={() => handleDelete(m.id)}
                    disabled={isDeleting}
                    style={{
                      background: isDeleting ? C.border : 'rgba(180,0,0,0.9)',
                      color: C.white,
                      padding: 6,
                      borderRadius: 4,
                      border: 'none',
                      cursor: isDeleting ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {isDeleting
                      ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
