import { ArrowLeft } from 'lucide-react';
import { C } from '../theme';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export function AppHeader({ title, subtitle, onBack }: AppHeaderProps) {
  return (
    <div
      style={{
        background: C.navy,
        color: C.white,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        borderBottom: `3px solid ${C.red}`,
      }}
    >
      {onBack && (
        <button onClick={onBack} style={{ color: C.white, padding: 4, display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="font-display" style={{ fontSize: 18, lineHeight: 1.1 }}>
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 11,
              opacity: 0.75,
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
