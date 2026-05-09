import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { C } from '../theme';

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: C.offwhite }}>
      <AppHeader
        title="Opportunity"
        subtitle={id}
        onBack={() => navigate('/')}
      />

      <div style={{ padding: 24, textAlign: 'center', color: C.muted }}>
        <p style={{ fontSize: 14 }}>Opportunity workspace — coming in Phase 1</p>
      </div>
    </div>
  );
}
