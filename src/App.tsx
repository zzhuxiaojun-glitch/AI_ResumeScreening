import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { Layout } from './components/Layout';
import { CandidatesPage } from './components/CandidatesPage';
import { PositionsPage } from './components/PositionsPage';
import { UploadPage } from './components/UploadPage';
import { EmailConfigPage } from './components/EmailConfigPage';
import { CandidateDetailPage } from './components/CandidateDetailPage';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('candidates');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleViewDetail = (id: string) => {
    setSelectedCandidateId(id);
    setCurrentPage('candidate-detail');
  };

  const handleBackFromDetail = () => {
    setSelectedCandidateId(null);
    setCurrentPage('candidates');
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {currentPage === 'candidates' && <CandidatesPage onViewDetail={handleViewDetail} />}
      {currentPage === 'positions' && <PositionsPage />}
      {currentPage === 'upload' && <UploadPage />}
      {currentPage === 'email-config' && <EmailConfigPage />}
      {currentPage === 'candidate-detail' && selectedCandidateId && (
        <CandidateDetailPage
          candidateId={selectedCandidateId}
          onBack={handleBackFromDetail}
        />
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
