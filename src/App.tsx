import React, { useState, useEffect } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GovTopBar } from './components/layout/GovTopBar';
import { PublicNavbar } from './components/layout/PublicNavbar';
import { PublicFooter } from './components/layout/PublicFooter';
import { PortalLayout } from './components/layout/PortalLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LandingPage } from './pages/public/LandingPage';
import { PublicMapPage } from './pages/public/PublicMapPage';
import { TransparencyPortal } from './pages/public/TransparencyPortal';
import { HowItWorksPage } from './pages/public/HowItWorksPage';
import { AboutPage } from './pages/public/AboutPage';
import { ResourcesPage } from './pages/public/ResourcesPage';
import { ContactPage } from './pages/public/ContactPage';
import { LoginPage } from './pages/public/LoginPage';
import { ForgotPasswordPage } from './pages/public/ForgotPasswordPage';
import { AgencyRegistrationPage } from './pages/public/AgencyRegistrationPage';
import { PortalSelectionPage } from './pages/public/PortalSelectionPage';
import { DemoSwitcher } from './components/common/DemoSwitcher';

// Government Portal Pages
import { GovDashboard } from './pages/government/GovDashboard';
import { TenderManagement } from './pages/government/TenderManagement';
import { ProposalReview } from './pages/government/ProposalReview';
import { RiskAlerts } from './pages/government/RiskAlerts';
import { FraudInvestigations } from './pages/government/FraudInvestigations';
import { ProjectMonitoring } from './pages/government/ProjectMonitoring';
import { AuditLogsPage } from './pages/government/AuditLogsPage';
import { AnalyticsReportsPage } from './pages/government/AnalyticsReportsPage';
import { SettingsSecurityPage } from './pages/government/SettingsSecurityPage';

// Agency Portal Pages
import { AgencyDashboard } from './pages/agency/AgencyDashboard';
import { LiveTendersPage } from './pages/agency/LiveTendersPage';
import { SubmittedProposalsPage } from './pages/agency/SubmittedProposalsPage';
import { ProjectMilestonesPage } from './pages/agency/ProjectMilestonesPage';
import { DisbursementsPage } from './pages/agency/DisbursementsPage';
import { ComplianceProfilePage } from './pages/agency/ComplianceProfilePage';

import { Tender } from './types';

function AppContent() {
  // Navigation State
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname !== '/' && window.location.pathname !== ''
      ? window.location.pathname
      : '/';
  });

  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);

  // Sync with browser history
  const navigate = (path: string) => {
    setCurrentPath(path);
    window.history.pushState({}, '', path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Router Engine
  const renderRoute = () => {
    // 1. Government Portal Routes (Protected by Government Role)
    if (currentPath.startsWith('/government')) {
      const renderGovPage = () => {
        switch (currentPath) {
          case '/government/dashboard':
            return <GovDashboard onNavigate={navigate} onSelectTender={setSelectedTender} />;
          case '/government/tenders':
            return <TenderManagement onNavigate={navigate} onSelectTender={setSelectedTender} />;
          case '/government/proposals':
            return <ProposalReview onNavigate={navigate} />;
          case '/government/risk-alerts':
            return <RiskAlerts onNavigate={navigate} />;
          case '/government/investigations':
            return <FraudInvestigations onNavigate={navigate} />;
          case '/government/projects':
            return <ProjectMonitoring onNavigate={navigate} />;
          case '/government/projects/map':
            return <PublicMapPage onNavigate={navigate} />;
          case '/government/audit-logs':
            return <AuditLogsPage onNavigate={navigate} />;
          case '/government/analytics':
            return <AnalyticsReportsPage onNavigate={navigate} />;
          case '/government/settings':
            return <SettingsSecurityPage onNavigate={navigate} />;
          default:
            return <GovDashboard onNavigate={navigate} onSelectTender={setSelectedTender} />;
        }
      };

      return (
        <ProtectedRoute
          requiredRole="government"
          currentPath={currentPath}
          onNavigate={navigate}
        >
          <PortalLayout
            portal="government"
            currentPath={currentPath}
            onNavigate={navigate}
          >
            {renderGovPage()}
          </PortalLayout>
        </ProtectedRoute>
      );
    }

    // 2. Agency Portal Routes (Protected by Agency Role)
    if (currentPath.startsWith('/agency')) {
      const renderAgencyPage = () => {
        switch (currentPath) {
          case '/agency/dashboard':
            return <AgencyDashboard onNavigate={navigate} />;
          case '/agency/tenders':
            return <LiveTendersPage onNavigate={navigate} />;
          case '/agency/proposals':
            return <SubmittedProposalsPage onNavigate={navigate} />;
          case '/agency/milestones':
            return <ProjectMilestonesPage onNavigate={navigate} />;
          case '/agency/disbursements':
            return <DisbursementsPage onNavigate={navigate} />;
          case '/agency/compliance':
            return <ComplianceProfilePage onNavigate={navigate} />;
          default:
            return <AgencyDashboard onNavigate={navigate} />;
        }
      };

      return (
        <ProtectedRoute
          requiredRole="agency"
          currentPath={currentPath}
          onNavigate={navigate}
        >
          <PortalLayout
            portal="agency"
            currentPath={currentPath}
            onNavigate={navigate}
          >
            {renderAgencyPage()}
          </PortalLayout>
        </ProtectedRoute>
      );
    }

    // 3. Public & Auth Routes (Wrapped in GovTopBar + PublicNavbar + PublicFooter)
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <GovTopBar />
        <PublicNavbar currentPath={currentPath} onNavigate={navigate} />

        <main className="flex-1 w-full">
          {(() => {
            switch (currentPath) {
              case '/':
                return <LandingPage onNavigate={navigate} />;
              case '/map':
                return (
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <PublicMapPage onNavigate={navigate} />
                  </div>
                );
              case '/transparency':
                return (
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <TransparencyPortal onNavigate={navigate} />
                  </div>
                );
              case '/how-it-works':
                return (
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <HowItWorksPage onNavigate={navigate} />
                  </div>
                );
              case '/about':
                return (
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <AboutPage />
                  </div>
                );
              case '/resources':
                return (
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <ResourcesPage />
                  </div>
                );
              case '/contact':
                return (
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <ContactPage />
                  </div>
                );
              case '/login':
                return (
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <LoginPage onNavigate={navigate} />
                  </div>
                );
              case '/forgot-password':
                return (
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <ForgotPasswordPage onNavigate={navigate} />
                  </div>
                );
              case '/register/agency':
                return (
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <AgencyRegistrationPage onNavigate={navigate} />
                  </div>
                );
              case '/portal-selection':
                return (
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <PortalSelectionPage onNavigate={navigate} />
                  </div>
                );
              default:
                return <LandingPage onNavigate={navigate} />;
            }
          })()}
        </main>

        <PublicFooter onNavigate={navigate} />
      </div>
    );
  };

  return (
    <>
      {renderRoute()}

      {/* Floating Demo Role Switcher Quick Pill */}
      <DemoSwitcher currentPath={currentPath} onNavigate={navigate} />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
