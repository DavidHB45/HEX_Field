import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, MapPin, Link as LinkIcon } from 'lucide-react';
import { C } from '../theme';

function SkeletonCard() {
  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton-line {
          background: linear-gradient(90deg, ${C.border} 25%, #ebebeb 50%, ${C.border} 75%);
          background-size: 800px 100%;
          animation: shimmer 1.4s ease-in-out infinite;
          border-radius: 3px;
        }
      `}</style>
      <div className="skeleton-line" style={{ height: 16, width: '70%', marginBottom: 10 }} />
      <div className="skeleton-line" style={{ height: 13, width: '45%', marginBottom: 10 }} />
      <div className="skeleton-line" style={{ height: 11, width: '55%', marginBottom: 14 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
        <div className="skeleton-line" style={{ height: 10, width: '30%' }} />
        <div className="skeleton-line" style={{ height: 10, width: '18%' }} />
      </div>
    </div>
  );
}

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

type LoadState = 'loading' | 'unauthenticated' | 'error' | 'ready';

export function OpportunitiesListPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>('loading');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/airtable/opportunities')
      .then(async (res) => {
        if (res.status === 401) {
          setState('unauthenticated');
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setOpportunities((data as { records: Opportunity[] }).records ?? []);
        setState('ready');
      })
      .catch((err) => {
        console.error(err);
        setState('error');
      });
  }, []);

  const filtered = opportunities.filter((o) => {
    const q = search.toLowerCase();
    const f = o.fields;
    return (
      (f['Opportunity Name'] ?? '').toLowerCase().includes(q) ||
      (f.Client ?? '').toLowerCase().includes(q) ||
      (f.Address ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ minHeight: '100vh', background: C.offwhite }}>
      {/* Header with integrated search */}
      <div style={{ background: C.navy, color: C.white, padding: '20px 16px 16px', position: 'sticky', top: 0, zIndex: 10, borderBottom: `3px solid ${C.red}` }}>
        <div className="font-display" style={{ fontSize: 22, marginBottom: 2 }}>
          HARRIS EXCAVATION
        </div>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 16 }}>Job Walk · Field Capture</div>

        {state === 'ready' && (
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: C.muted,
                pointerEvents: 'none',
              }}
            />
            <input
              type="search"
              inputMode="search"
              placeholder="Search opportunities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                borderRadius: 4,
                border: 'none',
                background: C.white,
                color: C.text,
                fontSize: 16,
              }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '8px 12px' }}>
        {state === 'loading' && (
          <div style={{ paddingTop: 8 }}>
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {state === 'error' && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ color: C.red, fontSize: 14, fontWeight: 600 }}>Could not load opportunities.</p>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: 12, background: C.navy, color: C.white, padding: '10px 20px', borderRadius: 4, fontSize: 13, fontWeight: 700 }}
            >
              Retry
            </button>
          </div>
        )}

        {state === 'unauthenticated' && (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ marginBottom: 16 }}>
              <LinkIcon size={40} color={C.muted} />
            </div>
            <p className="font-display" style={{ color: C.navy, fontSize: 18, marginBottom: 8 }}>
              CONNECT AIRTABLE
            </p>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
              Sign in with Airtable to access your Project Opportunities.
            </p>
            <a
              href="/api/auth/airtable/login"
              style={{
                display: 'inline-block',
                background: C.red,
                color: C.white,
                padding: '14px 32px',
                borderRadius: 4,
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
                letterSpacing: 0.5,
              }}
            >
              Connect Airtable
            </a>
          </div>
        )}

        {state === 'ready' && (
          <>
            <div
              style={{
                fontSize: 11,
                color: C.muted,
                fontWeight: 700,
                letterSpacing: 0.5,
                padding: '12px 4px 8px',
                textTransform: 'uppercase',
              }}
            >
              {filtered.length} Active {filtered.length === 1 ? 'Opportunity' : 'Opportunities'}
            </div>

            {filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: C.muted, fontSize: 14 }}>
                No opportunities match your search.
              </div>
            )}

            {filtered.map((opp) => {
              const f = opp.fields;
              const lastVisit = f['Last Site Visit'];
              const photoCount = f['Photos Count'] ?? 0;
              return (
                <button
                  key={opp.id}
                  onClick={() => navigate(`/opportunity/${opp.id}`)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: C.white,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    padding: 14,
                    marginBottom: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <div className="font-display" style={{ fontSize: 16, color: C.navy, lineHeight: 1.2 }}>
                      {f['Opportunity Name'] ?? opp.id}
                    </div>
                    <ChevronRight size={18} color={C.muted} style={{ flexShrink: 0, marginTop: 2 }} />
                  </div>

                  {f.Client && (
                    <div style={{ fontSize: 13, color: C.text }}>{f.Client}</div>
                  )}

                  {f.Address && (
                    <div style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} /> {f.Address}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 4,
                      paddingTop: 8,
                      borderTop: `1px solid ${C.border}`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: lastVisit ? C.navy : C.red,
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                      }}
                    >
                      {lastVisit ? `Visited ${lastVisit}` : 'Not Yet Visited'}
                    </span>
                    <span style={{ fontSize: 11, color: C.muted }}>
                      {photoCount > 0 ? `${photoCount} photos` : 'No photos'}
                    </span>
                  </div>
                </button>
              );
            })}
          </>
        )}
      </div>

      <div
        style={{
          background: C.navy,
          color: C.white,
          padding: '12px 16px',
          fontSize: 10,
          textAlign: 'center',
          opacity: 0.7,
          marginTop: 20,
        }}
      >
        CSLB #1117960 · Build Smarter. Dig Deeper.
      </div>
    </div>
  );
}
