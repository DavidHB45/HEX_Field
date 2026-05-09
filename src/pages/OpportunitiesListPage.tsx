import { AppHeader } from '../components/AppHeader';
import { C } from '../theme';

export function OpportunitiesListPage() {
  return (
    <div style={{ minHeight: '100vh', background: C.offwhite }}>
      <AppHeader title="HARRIS EXCAVATION" subtitle="Job Walk · Field Capture" />

      <div style={{ padding: 24, textAlign: 'center', color: C.muted }}>
        <p style={{ fontSize: 14 }}>Opportunities list — coming in Phase 1</p>
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
