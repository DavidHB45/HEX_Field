import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, Pencil, Ruler, Mic, FolderOpen, MapPin, type LucideIcon } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { C } from '../theme';

interface Opportunity {
  id: string;
  fields: {
    Name?: string;
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

function OverviewTab({ opp }: { opp: Opportunity }) {
  const f = opp.fields;
  return (
    <div style={{ padding: 16 }}>
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
        <div style={{ fontSize: 13, color: C.text, fontFamily: 'monospace', marginBottom: 4 }}>
          Current Opportunities/
        </div>
        <div style={{ fontSize: 13, color: C.text, fontFamily: 'monospace', marginLeft: 12 }}>
          └── {f['Opportunity Name'] ?? opp.id}/
        </div>
        <div style={{ fontSize: 12, color: C.muted, fontFamily: 'monospace', marginLeft: 28, marginTop: 4 }}>
          ├── Photos/ ({f['Photos Count'] ?? 0})
        </div>
        <div style={{ fontSize: 12, color: C.muted, fontFamily: 'monospace', marginLeft: 28 }}>
          ├── Sketches/
        </div>
        <div style={{ fontSize: 12, color: C.muted, fontFamily: 'monospace', marginLeft: 28 }}>
          ├── measurements.md
        </div>
        <div style={{ fontSize: 12, color: C.muted, fontFamily: 'monospace', marginLeft: 28 }}>
          └── site-notes.md
        </div>

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

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
      <p style={{ fontSize: 14 }}>{label} — coming in a future phase</p>
    </div>
  );
}

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!id) return;
    // We pull the full list and find our record — avoids a separate get-by-id endpoint for now.
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
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {!opp && !loadError && (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 14 }}>
          Loading…
        </div>
      )}

      {loadError && (
        <div style={{ padding: 40, textAlign: 'center', color: C.red, fontSize: 14 }}>
          Could not load this opportunity.
        </div>
      )}

      {opp && (
        <>
          {activeTab === 'overview' && <OverviewTab opp={opp} />}
          {activeTab === 'photos' && <PlaceholderTab label="Photos" />}
          {activeTab === 'sketches' && <PlaceholderTab label="Sketches" />}
          {activeTab === 'measure' && <PlaceholderTab label="Measurements" />}
          {activeTab === 'notes' && <PlaceholderTab label="Voice Notes" />}
        </>
      )}
    </div>
  );
}
