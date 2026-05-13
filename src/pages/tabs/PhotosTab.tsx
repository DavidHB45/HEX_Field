import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, MapPin, Trash2, RefreshCw, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { C } from '../../theme';
import { useToast } from '../../context/ToastContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RemotePhoto {
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
  status: UploadStatus;
  error?: string;
}

interface Gps {
  lat: number;
  lng: number;
}

interface PhotosTabProps {
  opportunityName: string;
  recordId: string;
  currentPhotosCount: number;
  lastSiteVisit: string | undefined;
  dropboxAuthRequired: boolean;
  onOppFieldsUpdate: (fields: { 'Photos Count'?: number; 'Last Site Visit'?: string }) => void;
  onAuthError?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGps(): Promise<Gps | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 30000 }
    );
  });
}

/** Re-draw to canvas to strip EXIF metadata. */
function stripExif(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => { if (blob) resolve(blob); else reject(new Error('toBlob failed')); },
        'image/jpeg',
        0.92
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
    img.src = objectUrl;
  });
}

function buildFilename(gps: Gps | null): string {
  const ts = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
  if (gps) {
    const lat = gps.lat.toFixed(6);
    const lng = gps.lng.toFixed(6);
    return `IMG_${ts}_${lat}_${lng}.jpg`;
  }
  return `IMG_${ts}.jpg`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
      <Camera size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
      <div style={{ fontSize: 13 }}>No photos captured yet</div>
    </div>
  );
}

function StatusIcon({ status }: { status: UploadStatus }) {
  if (status === 'uploading') return <Loader size={14} color={C.white} style={{ animation: 'spin 1s linear infinite' }} />;
  if (status === 'done') return <CheckCircle size={14} color={C.white} />;
  if (status === 'error') return <AlertCircle size={14} color={C.white} />;
  return null;
}

function UploadCard({
  item,
  onRetry,
}: {
  item: UploadItem;
  onRetry: (id: string) => void;
}) {
  const isError = item.status === 'error';
  const bgOverlay =
    item.status === 'uploading'
      ? 'rgba(38,62,87,0.7)'
      : item.status === 'error'
        ? 'rgba(180,0,0,0.7)'
        : 'rgba(0,0,0,0.4)';

  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '1',
        borderRadius: 4,
        overflow: 'hidden',
        border: `1px solid ${C.border}`,
      }}
    >
      <img
        src={item.previewUrl}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
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

function RemotePhotoCard({
  photo,
  onDelete,
  deleting,
}: {
  photo: RemotePhoto;
  onDelete: (path: string) => void;
  deleting: boolean;
}) {
  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '1',
        borderRadius: 4,
        overflow: 'hidden',
        border: `1px solid ${C.border}`,
        opacity: deleting ? 0.5 : 1,
      }}
    >
      <img
        src={photo.url}
        alt={photo.filename}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        loading="lazy"
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
          color: C.white,
          padding: '12px 6px 4px',
          fontSize: 9,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <MapPin size={9} /> GPS tagged
        </div>
      </div>
      <button
        onClick={() => onDelete(photo.path)}
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

export function PhotosTab({
  opportunityName,
  recordId,
  currentPhotosCount,
  lastSiteVisit,
  dropboxAuthRequired,
  onOppFieldsUpdate,
  onAuthError,
}: PhotosTabProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [remotePhotos, setRemotePhotos] = useState<RemotePhoto[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [deletingPaths, setDeletingPaths] = useState<Set<string>>(new Set());
  const uploadingRef = useRef(false);

  // ── Fetch existing photos from Dropbox ──────────────────────────────────────
  const fetchRemotePhotos = useCallback(async () => {
    setLoadingRemote(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ opportunityName });
      const res = await fetch(`/api/dropbox/photos?${params}`);
      if (res.status === 401) { onAuthError?.(); return; }
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { photos: RemotePhoto[] };
      setRemotePhotos(data.photos);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoadError(msg);
      showToast('network', 'Could not load photos — check your connection');
    } finally {
      setLoadingRemote(false);
    }
  }, [opportunityName, showToast, onAuthError]);

  useEffect(() => {
    if (!dropboxAuthRequired) fetchRemotePhotos();
  }, [fetchRemotePhotos, dropboxAuthRequired]);

  // ── Upload a single item ────────────────────────────────────────────────────
  const uploadItem = useCallback(async (item: UploadItem) => {
    setUploadQueue((q) => q.map((i) => i.id === item.id ? { ...i, status: 'uploading' } : i));

    try {
      const form = new FormData();
      // Server constructs the full Dropbox path from these semantic fields.
      form.append('opportunityName', opportunityName);
      form.append('subFolder', 'Photos');
      form.append('filename', item.filename);
      form.append('file', item.blob, item.filename);

      const res = await fetch('/api/dropbox/upload', { method: 'POST', body: form });
      if (res.status === 401) { onAuthError?.(); throw new Error('Session expired — reconnect Dropbox'); }
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
      showToast('error', `Upload failed: ${item.filename}`);
      return false;
    }
  }, [opportunityName, showToast, onAuthError]);

  // ── Process the upload queue sequentially ───────────────────────────────────
  const drainQueue = useCallback(
    async (queue: UploadItem[], countBefore: number, visitBefore: string | undefined) => {
      if (uploadingRef.current) return;
      uploadingRef.current = true;

      const pending = queue.filter((i) => i.status === 'pending');
      let successCount = 0;

      try {
        for (const item of pending) {
          const ok = await uploadItem(item);
          if (ok) successCount++;
        }
      } finally {
        uploadingRef.current = false;
      }

      if (successCount > 0) {
        const newCount = countBefore + successCount;
        const today = todayIso();
        const fields: { 'Photos Count': number; 'Last Site Visit'?: string } = {
          'Photos Count': newCount,
        };
        if (!visitBefore || visitBefore !== today) {
          fields['Last Site Visit'] = today;
        }

        try {
          const res = await fetch(`/api/airtable/opportunities/${recordId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields }),
          });
          if (res.ok) onOppFieldsUpdate(fields);
        } catch (err) {
          console.error('[PhotosTab] Airtable PATCH failed', err);
        }

        await fetchRemotePhotos();
      }

      // If items were added while we were uploading, drain the new ones
      setUploadQueue((current) => {
        const stillPending = current.filter((i) => i.status === 'pending');
        if (stillPending.length > 0) {
          setTimeout(() => drainQueue(current, countBefore + successCount, visitBefore), 0);
        }
        return current;
      });
    },
    [uploadItem, recordId, fetchRemotePhotos, onOppFieldsUpdate]
  );

  // ── Camera capture handler ──────────────────────────────────────────────────
  const handleCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;

      // Reset input so the same file can be selected again
      e.target.value = '';

      // Kick off GPS in parallel with EXIF stripping
      const [gps, ...strippedBlobs] = await Promise.all([
        getGps(),
        ...files.map((f) => stripExif(f)),
      ]);

      const newItems: UploadItem[] = strippedBlobs.map((blob, i) => {
        const filename = buildFilename(gps);
        // Ensure unique filenames if multiple photos taken at same millisecond
        const uniqueFilename = i === 0 ? filename : filename.replace('.jpg', `_${i}.jpg`);
        const previewUrl = URL.createObjectURL(blob);
        return {
          id: `${Date.now()}_${i}`,
          filename: uniqueFilename,
          previewUrl,
          blob,
          status: 'pending' as const,
        };
      });

      setUploadQueue((prev) => {
        const next = [...prev, ...newItems];
        // Start draining after state update (use setTimeout to let state settle)
        setTimeout(() => drainQueue(next, currentPhotosCount, lastSiteVisit), 0);
        return next;
      });
    },
    [opportunityName, currentPhotosCount, lastSiteVisit, drainQueue]
  );

  // ── Retry a failed item ─────────────────────────────────────────────────────
  const handleRetry = useCallback(
    (id: string) => {
      setUploadQueue((prev) => {
        const item = prev.find((i) => i.id === id);
        if (!item) return prev;
        const updated = prev.map((i) => i.id === id ? { ...i, status: 'pending' as const, error: undefined } : i);
        setTimeout(() => drainQueue(updated, currentPhotosCount, lastSiteVisit), 0);
        return updated;
      });
    },
    [currentPhotosCount, lastSiteVisit, drainQueue]
  );

  // ── Delete a remote photo ───────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (path: string) => {
      setDeletingPaths((s) => new Set(s).add(path));
      try {
        const res = await fetch(`/api/dropbox/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
        if (!res.ok) {
          const body = await res.json() as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }

        setRemotePhotos((prev) => prev.filter((p) => p.path !== path));

        const newCount = Math.max(0, currentPhotosCount - 1);
        try {
          await fetch(`/api/airtable/opportunities/${recordId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: { 'Photos Count': newCount } }),
          });
          onOppFieldsUpdate({ 'Photos Count': newCount });
        } catch (err) {
          console.error('[PhotosTab] Airtable PATCH after delete failed', err);
        }
      } catch (err) {
        console.error('[PhotosTab] delete failed', err);
        alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setDeletingPaths((s) => { const next = new Set(s); next.delete(path); return next; });
      }
    },
    [currentPhotosCount, recordId, onOppFieldsUpdate]
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  if (dropboxAuthRequired) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.muted }}>
        <p style={{ fontSize: 14, marginBottom: 16 }}>
          Connect Dropbox to capture and sync photos.
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

  const inProgressItems = uploadQueue.filter((i) => i.status !== 'done');
  const totalItems = remotePhotos.length + inProgressItems.length;
  const hasContent = totalItems > 0;

  return (
    <div style={{ padding: 16 }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleCapture}
        style={{ display: 'none' }}
      />

      {/* Capture button */}
      <button
        onClick={() => fileInputRef.current?.click()}
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
        <Camera size={20} /> CAPTURE PHOTO
      </button>

      {/* Loading state */}
      {loadingRemote && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: 13 }}>
          Loading photos…
        </div>
      )}

      {/* Load error */}
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
          <span>Could not load photos: {loadError}</span>
          <button
            onClick={fetchRemotePhotos}
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

      {/* Empty state */}
      {!loadingRemote && !hasContent && <EmptyState />}

      {/* Photo grid */}
      {!loadingRemote && hasContent && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {/* In-progress uploads first */}
          {inProgressItems.map((item) => (
            <UploadCard key={item.id} item={item} onRetry={handleRetry} />
          ))}

          {/* Remote (already uploaded) photos */}
          {remotePhotos.map((photo) => (
            <RemotePhotoCard
              key={photo.path}
              photo={photo}
              onDelete={handleDelete}
              deleting={deletingPaths.has(photo.path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
