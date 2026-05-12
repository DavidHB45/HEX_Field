import { Component, type ReactNode } from 'react';
import { C } from '../theme';

interface Props {
  tabName: string;
  children: ReactNode;
}

interface State {
  crashed: boolean;
  error: Error | null;
}

export class TabErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { crashed: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { crashed: true, error };
  }

  override componentDidCatch(error: Error) {
    console.error(`[TabErrorBoundary] ${this.props.tabName} crashed:`, error);
  }

  handleReset = () => {
    this.setState({ crashed: false, error: null });
  };

  override render() {
    if (!this.state.crashed) return this.props.children;

    return (
      <div
        style={{
          padding: '40px 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            background: C.cream,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            padding: 24,
          }}
        >
          <div
            className="font-display"
            style={{ fontSize: 15, color: C.red, marginBottom: 8 }}
          >
            {this.props.tabName.toUpperCase()} ERROR
          </div>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
            Something went wrong in this tab. Your other tabs are unaffected.
          </p>
          {this.state.error && (
            <p style={{ fontSize: 11, color: C.muted, marginBottom: 16, fontFamily: 'monospace', wordBreak: 'break-word' }}>
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleReset}
            style={{
              background: C.navy,
              color: C.white,
              padding: '10px 24px',
              borderRadius: 4,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: 0.5,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            RETRY TAB
          </button>
        </div>
      </div>
    );
  }
}
