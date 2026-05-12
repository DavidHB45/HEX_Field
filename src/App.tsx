import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { FontImports } from './theme';
import { ToastProvider } from './context/ToastContext';
import { OpportunitiesListPage } from './pages/OpportunitiesListPage';
import { OpportunityDetailPage } from './pages/OpportunityDetailPage';
import { IOSInstallPrompt } from './components/IOSInstallPrompt';

export function App() {
  return (
    <ToastProvider>
      <FontImports />
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh' }}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<OpportunitiesListPage />} />
            <Route path="/opportunity/:id" element={<OpportunityDetailPage />} />
          </Routes>
        </BrowserRouter>
      </div>
      <IOSInstallPrompt />
    </ToastProvider>
  );
}
