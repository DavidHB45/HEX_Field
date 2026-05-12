import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, Pencil, Ruler, Mic, FolderOpen, MapPin, type LucideIcon } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { TabErrorBoundary } from '../components/TabErrorBoundary';
import { C } from '../theme';
import type { DropboxFolderStats } from '../lib/dropbox';
import { PhotosTab } from './tabs/PhotosTab';
import { SketchesTab } from './tabs/SketchesTab';
import { MeasurementsTab } from './tabs/MeasurementsTab';
import { NotesTab } from './tabs/NotesTab';

interface Opportunity {
  id: string;
  fields: {
    'Opportunity Name'?: string;
    Client?: string;
    Address?: string;
    Status?: string;
    'Estimated Value'?: string | number;
    'Last Site Visit'?: string;
    'Photos Count'?: number;
    'Dropbox Folder URL'?: string;
  };
}

type TabId = 'overview' | 'photos' | 'sketches' | 'measure' | 'notes';

const TABS: { id: TabId; label: string; Icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', Icon: FolderOpen },
  { id: 'photos', label: 'Photos', Icon: Camera },
  { id: 'sketches', label: 'Sketches', Icon: Pencil },
  { id: 'measure', label: 'Measure', Icon: Ruler },
  { id: 'notes', label: 'Notes', Icon: Mic },
];

function DetailRow({ label, value }: { label: string; value: string | number | undefined }) {
  if (!value) return null;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: `1px solid ${C.border}`,
        fontSize: 13,
      }}
    >
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ color: C.text, fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

function FolderStatLine({
  label,
  count,
  exists,
}: {
  label: string;
  count?: number;
  exists?: boolean;
}) {
  const suffix = count !== undefined ? ` (${count})` : exists !== undefined ? (exists ? ' ✓' : '') : '';
  return (
    <div style={{ fontSize: 12, color: C.muted, fontFamily: 'monospace', marginLeft: 28 }}>
      {label}{suffix}
    </div>
  );
}

function OverviewTab({
  opp,
  folderCreating,
  folderError,
  dropboxAuthRequired,
  stats,
}: {
  opp: Opportunity;
  folderCreating: boolean;
  folderError: string | null;
  dropboxAuthRequired: boolean;
  stats: DropboxFolderStats | null;
}) {
  const f = opp.fields;
  const oppName = f['Opportunity Name'] ?? opp.id;
  const rootLabel = (process.env.DROPBOX_ROOT_FOLDER ?? '01 - Operations/1. Project Opportunites/1. Current Opportunities')
    .replace(/^\//, '')
    .replace(/\/$/, '');

  return (
    <div style={{ padding: 16 }}>
      {/* Dropbox folder card */}
      <div
        style={{
          background: C.cream,
          border: `1px solid ${C.border}`,
          padding: 16,
          marginBottom: 16,
          borderRadius: 4,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: C.navy,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Dropbox Folder
        </div>

        {folderCreating && (
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>
            Creating folder structure…
          </div>
        )}

        {!folderCreating && dropboxAuthRequired && (
          <div style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>
              Connect Dropbox to create and sync your job-walk folder.
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
        )}

        {!folderCreating && !dropboxAuthRequired && folderError && (
          <div style={{ fontSize: 13, color: C.red, marginBottom: 8 }}>
            {folderError}
          </div>
        )}

        {!folderCreating && (
          <>
            <div style={{ fontSize: 13, color: C.text, fontFamily: 'monospace', marginBottom: 4 }}>
              {rootLabel}/
            </div>
            <div style={{ fontSize: 13, color: C.text, fontFamily: 'monospace', marginLeft: 12 }}>
              └── {oppName}/
            </div>
            <FolderStatLine
              label="├── Photos/"
              count={stats?.photos ?? f['Photos Count'] ?? 0}
            />
            <FolderStatLine label="├── Sketches/" count={stats?.sketches ?? 0} />
            <FolderStatLine
              label="├── measurements.md"
              exists={stats?.measurementsExists}
            />
            <FolderStatLine
              label="└── site-notes.md"
              exists={stats?.notesExists}
            />
          </>
        )}

        {f['Dropbox Folder URL'] && (
          <a
            href={f['Dropbox Folder URL']}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-block',
              marginTop: 12,
              fontSize: 12,
              color: C.navy,
              fontWeight: 600,
              textDecoration: 'underline',
            }}
          >
            Open in Dropbox ↗
          </a>
        )}
      </div>

      {/* Opportunity details card */}
      <div
        style={{
          background: C.white,
          border: `1px solid ${C.border}`,
          padding: 16,
          marginBottom: 16,
          borderRadius: 4,
        }}
      >
        <div className="font-display" style={{ fontSize: 14, color: C.navy, marginBottom: 12 }}>
          OPPORTUNITY DETAILS
        </div>
        <DetailRow label="Client" value={f.Client} />
        {f.Address && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 0',
              borderBottom: `1px solid ${C.border}`,
              fontSize: 13,
            }}
          >
            <span style={{ color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={12} /> Address
            </span>
            <span style={{ color: C.text, fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>
              {f.Address}
            </span>
          </div>
        )}
        <DetailRow label="Status" value={f.Status} />
        <DetailRow label="Est. Value" value={f['Estimated Value']} />
        <DetailRow label="Last Visit" value={f['Last Site Visit']} />
      </div>

      <div
        style={{
          background: C.navy,
          color: C.white,
          padding: 14,
          borderRadius: 4,
          textAlign: 'center',
        }}
      >
        <div className="font-display" style={{ fontSize: 13, marginBottom: 4 }}>
          BUILD SMARTER. DIG DEEPER.
        </div>
        <div style={{ fontSize: 10, opacity: 0.7 }}>Tap any tab above to start capturing</div>
      </div>
    </div>
  );
}

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [folderCreating, setFolderCreating] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [dropboxAuthRequired, setDropboxAuthRequired] = useState(false);
  const [stats, setStats] = useState<DropboxFolderStats | null>(null);

  // Load the opportunity record
  useEffect(() => {
    if (!id) return;
    fetch('/api/airtable/opportunities')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { records: Opportunity[] } = await res.json();
        const found = data.records.find((r) => r.id === id);
        if (found) {
          setOpp(found);
        } else {
          setLoadError(true);
        }
      })
      .catch(() => setLoadError(true));
  }, [id]);

  // Auto-create Dropbox folder when opp loads without one, then fetch stats
  useEffect(() => {
    if (!opp) return;
    const oppName = opp.fields['Opportunity Name'];
    if (!oppName) return;

    if (!opp.fields['Dropbox Folder URL']) {
      setFolderCreating(true);
      setFolderError(null);

      fetch('/api/dropbox/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityName: oppName }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json() as { error?: string; code?: string; detail?: string };
            if (body.code === 'UNAUTHENTICATED') {
              setDropboxAuthRequired(true);
              return;
            }
            throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`);
          }
          const data = await res.json() as { folderUrl: string };
          // Write the URL back to Airtable
          await fetch(`/api/airtable/opportunities/${opp.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: { 'Dropbox Folder URL': data.folderUrl } }),
          });
          setOpp((prev) =>
            prev
              ? { ...prev, fields: { ...prev.fields, 'Dropbox Folder URL': data.folderUrl } }
              : prev
          );
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          setFolderError(`Could not create Dropbox folder: ${message}`);
        })
        .finally(() => setFolderCreating(false));
    }

    // Fetch live folder stats
    const params = new URLSearchParams({ opportunityName: oppName });
    fetch(`/api/dropbox/folder-stats?${params}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as DropboxFolderStats;
        setStats(data);
      })
      .catch(() => { /* stats are best-effort */ });
  }, [opp?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = opp?.fields['Opportunity Name'] ?? 'Opportunity';
  const subtitle = opp?.fields.Client;

  return (
    <div style={{ minHeight: '100vh', background: C.offwhite, paddingBottom: 80 }}>
      <AppHeader title={title} subtitle={subtitle} onBack={() => navigate('/')} />

      {/* Tab bar */}
      <div
        style={{
          background: C.white,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          overflowX: 'auto',
          position: 'sticky',
          top: 60,
          zIndex: 9,
        }}
      >
        {TABS.map(({ id: tabId, label, Icon }) => {
          const active = activeTab === tabId;
          const count = tabId === 'photos' ? (opp?.fields['Photos Count'] ?? 0) : 0;
          return (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              style={{
                flex: '0 0 auto',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                color: active ? C.red : C.muted,
                borderBottom: `3px solid ${active ? C.red : 'transparent'}`,
                minWidth: 70,
                position: 'relative',
              }}
            >
              <Icon size={20} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {label}
              </span>
              {count > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 10,
                    background: C.red,
                    color: C.white,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: 8,
                    minWidth: 16,
                    textAlign: 'center',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {!opp && !loadError && (
        <div style={{ padding: 16 }}>
          <style>{`
            @keyframes shimmer {
              0% { background-position: -400px 0; }
              100% { background-position: 400px 0; }
            }
            .sk { background: linear-gradient(90deg, ${C.border} 25%, #ebebeb 50%, ${C.border} 75%); background-size: 800px 100%; animation: shimmer 1.4s ease-in-out infinite; border-radius: 3px; }
          `}</style>
          {/* Folder card skeleton */}
          <div style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16, marginBottom: 16 }}>
            <div className="sk" style={{ height: 10, width: '40%', marginBottom: 12 }} />
            <div className="sk" style={{ height: 13, width: '60%', marginBottom: 6 }} />
            <div className="sk" style={{ height: 12, width: '75%', marginBottom: 6 }} />
            <div className="sk" style={{ height: 12, width: '55%', marginBottom: 6 }} />
            <div className="sk" style={{ height: 12, width: '65%', marginBottom: 6 }} />
            <div className="sk" style={{ height: 12, width: '60%' }} />
          </div>
          {/* Details card skeleton */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16 }}>
            <div className="sk" style={{ height: 14, width: '50%', marginBottom: 16 }} />
            {[80, 60, 70, 55, 65].map((w, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: `1px solid ${C.border}`, marginBottom: 10 }}>
                <div className="sk" style={{ height: 13, width: '25%' }} />
                <div className="sk" style={{ height: 13, width: `${w * 0.4}%` }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {loadError && (
        <div style={{ padding: 40, textAlign: 'center', color: C.red, fontSize: 14 }}>
          Could not load this opportunity.
        </div>
      )}

      {opp && (
        <>
          {activeTab === 'overview' && (
            <TabErrorBoundary tabName="Overview">
              <OverviewTab
                opp={opp}
                folderCreating={folderCreating}
                folderError={folderError}
                dropboxAuthRequired={dropboxAuthRequired}
                stats={stats}
              />
            </TabErrorBoundary>
          )}
          {activeTab === 'photos' && (
            <TabErrorBoundary tabName="Photos">
              <PhotosTab
                opportunityName={opp.fields['Opportunity Name'] ?? opp.id}
                recordId={opp.id}
                currentPhotosCount={opp.fields['Photos Count'] ?? 0}
                lastSiteVisit={opp.fields['Last Site Visit']}
                dropboxAuthRequired={dropboxAuthRequired}
                onOppFieldsUpdate={(fields) =>
                  setOpp((prev) =>
                    prev ? { ...prev, fields: { ...prev.fields, ...fields } } : prev
                  )
                }
              />
            </TabErrorBoundary>
          )}
          {activeTab === 'sketches' && (
            <TabErrorBoundary tabName="Sketches">
              <SketchesTab
                opportunityName={opp.fields['Opportunity Name'] ?? opp.id}
                dropboxAuthRequired={dropboxAuthRequired}
              />
            </TabErrorBoundary>
          )}
          {activeTab === 'measure' && (
            <TabErrorBoundary tabName="Measure">
              <MeasurementsTab
                opportunityName={opp.fields['Opportunity Name'] ?? opp.id}
                dropboxAuthRequired={dropboxAuthRequired}
              />
            </TabErrorBoundary>
          )}
          {activeTab === 'notes' && (
            <TabErrorBoundary tabName="Notes">
              <NotesTab
                opportunityName={opp.fields['Opportunity Name'] ?? opp.id}
                opportunityAddress={opp.fields.Address}
                dropboxAuthRequired={dropboxAuthRequired}
              />
            </TabErrorBoundary>
          )}
        </>
      )}
    </div>
  );
}
