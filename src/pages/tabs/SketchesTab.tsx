import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, RefreshCw, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { C } from '../../theme';
import { SketchCanvas } from '../../components/SketchCanvas';
import { useToast } from '../../context/ToastContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RemoteSketch {
  filename: string;
  path: string;
  url: string;
}

type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

interface UploadItem {
  id: string;
  filename: string;
  previewUrl: string;
  blob: Blob;
  dropboxPath: string;
  status: UploadStatus;
  error?: string;
}

interface SketchesTabProps {
  opportunityName: string;
  dropboxAuthRequired: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function buildSketchFilename(): string {
  const ts = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
  return `sketch_${ts}.png`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
      <Pencil size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
      <div style={{ fontSize: 13 }}>No sketches yet — tap above to draw with Apple Pencil</div>
    </div>
  );
}

function StatusIcon({ status }: { status: UploadStatus }) {
  if (status === 'uploading') return <Loader size={14} color={C.white} style={{ animation: 'spin 1s linear infinite' }} />;
  if (status === 'done') return <CheckCircle size={14} color={C.white} />;
  if (status === 'error') return <AlertCircle size={14} color={C.white} />;
  return null;
}

function UploadCard({ item, onRetry }: { item: UploadItem; onRetry: (id: string) => void }) {
  const isError = item.status === 'error';
  const bgOverlay =
    item.status === 'uploading' ? 'rgba(38,62,87,0.7)' :
    item.status === 'error' ? 'rgba(180,0,0,0.7)' : 'rgba(0,0,0,0.4)';

  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '4/3',
        borderRadius: 4,
        overflow: 'hidden',
        border: `1px solid ${C.border}`,
        background: '#E8F0E2',
      }}
    >
      <img src={item.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: bgOverlay,
          color: C.white,
          padding: '8px 6px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 9,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <StatusIcon status={item.status} />
          {item.status === 'pending' && 'Queued'}
          {item.status === 'uploading' && 'Uploading…'}
          {item.status === 'done' && 'Uploaded'}
          {item.status === 'error' && 'Failed'}
        </span>
        {isError && (
          <button
            onClick={() => onRetry(item.id)}
            style={{
              background: C.white,
              color: C.red,
              border: 'none',
              borderRadius: 3,
              padding: '2px 6px',
              fontSize: 9,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={9} /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

function RemoteSketchCard({
  sketch,
  onDelete,
  deleting,
}: {
  sketch: RemoteSketch;
  onDelete: (path: string) => void;
  deleting: boolean;
}) {
  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '4/3',
        borderRadius: 4,
        overflow: 'hidden',
        border: `1px solid ${C.border}`,
        background: '#E8F0E2',
        opacity: deleting ? 0.5 : 1,
      }}
    >
      <img
        src={sketch.url}
        alt={sketch.filename}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        loading="lazy"
      />
      <button
        onClick={() => onDelete(sketch.path)}
        disabled={deleting}
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          background: 'rgba(180,0,0,0.9)',
          color: C.white,
          padding: 4,
          borderRadius: 4,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
        }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SketchesTab({ opportunityName, dropboxAuthRequired }: SketchesTabProps) {
  const { showToast } = useToast();
  const [drawing, setDrawing] = useState(false);
  const [remoteSketches, setRemoteSketches] = useState<RemoteSketch[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [deletingPaths, setDeletingPaths] = useState<Set<string>>(new Set());
  const uploadingRef = useRef(false);

  // ── Fetch existing sketches ─────────────────────────────────────────────────
  const fetchRemoteSketches = useCallback(async () => {
    setLoadingRemote(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ opportunityName });
      const res = await fetch(`/api/dropbox/sketches?${params}`);
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { sketches: RemoteSketch[] };
      setRemoteSketches(data.sketches);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoadError(msg);
      showToast('network', 'Could not load sketches — check your connection');
    } finally {
      setLoadingRemote(false);
    }
  }, [opportunityName, showToast]);

  useEffect(() => {
    if (!dropboxAuthRequired) fetchRemoteSketches();
  }, [fetchRemoteSketches, dropboxAuthRequired]);

  // ── Upload a single item ────────────────────────────────────────────────────
  const uploadItem = useCallback(async (item: UploadItem) => {
    setUploadQueue((q) => q.map((i) => i.id === item.id ? { ...i, status: 'uploading' } : i));
    try {
      const form = new FormData();
      form.append('targetPath', item.dropboxPath);
      form.append('file', item.blob, item.filename);
      const res = await fetch('/api/dropbox/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json() as { error?: string; detail?: string };
        throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`);
      }
      setUploadQueue((q) => q.map((i) => i.id === item.id ? { ...i, status: 'done' } : i));
      showToast('success', `${item.filename} uploaded`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadQueue((q) => q.map((i) => i.id === item.id ? { ...i, status: 'error', error: msg } : i));
      showToast('error', `Sketch upload failed`);
      return false;
    }
  }, [showToast]);

  // ── Drain the upload queue ──────────────────────────────────────────────────
  const drainQueue = useCallback(
    async (queue: UploadItem[]) => {
      if (uploadingRef.current) return;
      uploadingRef.current = true;
      const pending = queue.filter((i) => i.status === 'pending');
      let anySuccess = false;
      try {
        for (const item of pending) {
          const ok = await uploadItem(item);
          if (ok) anySuccess = true;
        }
      } finally {
        uploadingRef.current = false;
      }
      if (anySuccess) await fetchRemoteSketches();

      // If items were added while we were uploading, drain the new ones
      setUploadQueue((current) => {
        const stillPending = current.filter((i) => i.status === 'pending');
        if (stillPending.length > 0) {
          setTimeout(() => drainQueue(current), 0);
        }
        return current;
      });
    },
    [uploadItem, fetchRemoteSketches]
  );

  // ── Canvas save handler ─────────────────────────────────────────────────────
  const handleSave = useCallback(
    (dataUrl: string) => {
      setDrawing(false);
      const filename = buildSketchFilename();
      const blob = dataUrlToBlob(dataUrl);
      const root = (import.meta.env.VITE_DROPBOX_ROOT_FOLDER ?? '01 - Operations/1. Project Opportunites/1. Current Opportunities')
        .replace(/^\//, '')
        .replace(/\/$/, '');
      const dropboxPath = `/${root}/${opportunityName}/Sketches/${filename}`;

      const newItem: UploadItem = {
        id: `sketch_${Date.now()}`,
        filename,
        previewUrl: dataUrl,
        blob,
        dropboxPath,
        status: 'pending',
      };

      setUploadQueue((prev) => {
        const next = [...prev, newItem];
        setTimeout(() => drainQueue(next), 0);
        return next;
      });
    },
    [opportunityName, drainQueue]
  );

  // ── Retry a failed upload ───────────────────────────────────────────────────
  const handleRetry = useCallback(
    (id: string) => {
      setUploadQueue((prev) => {
        const item = prev.find((i) => i.id === id);
        if (!item) return prev;
        const updated = prev.map((i) =>
          i.id === id ? { ...i, status: 'pending' as const, error: undefined } : i
        );
        setTimeout(() => drainQueue(updated), 0);
        return updated;
      });
    },
    [drainQueue]
  );

  // ── Delete a remote sketch ──────────────────────────────────────────────────
  const handleDelete = useCallback(async (path: string) => {
    setDeletingPaths((s) => new Set(s).add(path));
    try {
      const res = await fetch(`/api/dropbox/file?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setRemoteSketches((prev) => prev.filter((s) => s.path !== path));
    } catch (err) {
      console.error('[SketchesTab] delete failed', err);
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingPaths((s) => { const next = new Set(s); next.delete(path); return next; });
    }
  }, []);

  // ── Drawing mode ─────────────────────────────────────────────────────────────
  if (drawing) {
    return <SketchCanvas onSave={handleSave} onCancel={() => setDrawing(false)} />;
  }

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (dropboxAuthRequired) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.muted }}>
        <p style={{ fontSize: 14, marginBottom: 16 }}>
          Connect Dropbox to capture and sync sketches.
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

  // ── Normal view ──────────────────────────────────────────────────────────────
  const inProgressItems = uploadQueue.filter((i) => i.status !== 'done');
  const hasContent = remoteSketches.length + inProgressItems.length > 0;

  return (
    <div style={{ padding: 16 }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <button
        onClick={() => setDrawing(true)}
        style={{
          width: '100%',
          background: C.red,
          color: C.white,
          padding: 16,
          borderRadius: 4,
          fontWeight: 700,
          fontSize: 14,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          letterSpacing: 0.5,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <Pencil size={20} /> NEW SKETCH
      </button>

      {loadingRemote && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: 13 }}>
          Loading sketches…
        </div>
      )}

      {loadError && !loadingRemote && (
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
          <span>Could not load sketches: {loadError}</span>
          <button
            onClick={fetchRemoteSketches}
            style={{
              background: C.navy,
              color: C.white,
              padding: '6px 12px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!loadingRemote && !hasContent && <EmptyState />}

      {!loadingRemote && hasContent && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {inProgressItems.map((item) => (
            <UploadCard key={item.id} item={item} onRetry={handleRetry} />
          ))}
          {remoteSketches.map((sketch) => (
            <RemoteSketchCard
              key={sketch.path}
              sketch={sketch}
              onDelete={handleDelete}
              deleting={deletingPaths.has(sketch.path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
