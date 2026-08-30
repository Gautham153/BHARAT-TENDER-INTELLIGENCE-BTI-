import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export interface PortalLayoutProps {
  portal: 'government' | 'agency' | 'public';
  currentPath: string;
  onNavigate: (path: string) => void;
  title?: string;
  children: React.ReactNode;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({
  portal,
  currentPath,
  onNavigate,
  title,
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          portal={portal}
          currentPath={currentPath}
          onNavigate={onNavigate}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          onLogout={() => onNavigate('/login')}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-72 h-full">
            <Sidebar
              portal={portal}
              currentPath={currentPath}
              onNavigate={(path) => {
                onNavigate(path);
                setMobileSidebarOpen(false);
              }}
              isCollapsed={false}
              onToggleCollapse={() => {}}
              onLogout={() => {
                onNavigate('/login');
                setMobileSidebarOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          portal={portal}
          title={title}
          onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
          onNavigate={onNavigate}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
