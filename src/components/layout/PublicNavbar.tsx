import React, { useState } from 'react';
import { Menu, X, ArrowRight, Shield, Building2, Users, LogOut, User as UserIcon } from 'lucide-react';
import { BtiLogo } from '../common/BtiLogo';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';

export interface PublicNavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const PublicNavbar: React.FC<PublicNavbarProps> = ({ currentPath, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  const navLinks = [
    { label: 'About', path: '/about' },
    { label: 'How It Works', path: '/how-it-works' },
    { label: 'Transparency', path: '/transparency' },
    { label: 'Resources', path: '/resources' },
    { label: 'Contact', path: '/contact' },
  ];

  const handleOpenWorkspace = () => {
    if (user?.role === 'government') {
      onNavigate('/government/dashboard');
    } else if (user?.role === 'agency') {
      onNavigate('/agency/dashboard');
    } else {
      onNavigate('/portal-selection');
    }
  };

  return (
    <header className="w-full bg-white border-b border-slate-200/90 shadow-2xs z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div onClick={() => onNavigate('/')} className="cursor-pointer">
          <BtiLogo size="md" />
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => {
            const isActive = currentPath === link.path;
            return (
              <button
                key={link.path}
                type="button"
                onClick={() => onNavigate(link.path)}
                className={`text-sm font-semibold transition-colors cursor-pointer ${
                  isActive ? 'text-[#002B49]' : 'text-slate-600 hover:text-[#002B49]'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Action CTAs */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenWorkspace}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200/70 transition-all cursor-pointer text-xs font-semibold text-slate-800"
              >
                <div className="w-5 h-5 rounded-full bg-[#002B49] text-white flex items-center justify-center text-[10px] font-bold">
                  {user.name.charAt(0)}
                </div>
                <span className="max-w-[120px] truncate">{user.name}</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-100/80 text-[#002B49]">
                  {user.role}
                </span>
              </button>

              <Button
                variant="gov"
                size="sm"
                onClick={handleOpenWorkspace}
                icon={ArrowRight}
                iconPosition="right"
                className="bg-[#002B49] text-white"
              >
                Workspace
              </Button>

              <button
                type="button"
                onClick={() => logout()}
                title="Sign Out"
                className="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('/login')}
                className="text-slate-700 font-semibold"
              >
                Login
              </Button>
              <Button
                variant="gov"
                size="sm"
                onClick={() => onNavigate('/register/agency')}
                icon={ArrowRight}
                iconPosition="right"
                className="bg-[#002B49] text-white"
              >
                Get Started
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle Button */}
        <div className="md:hidden flex items-center">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-6 space-y-3">
          <div className="flex flex-col space-y-2 pt-2 pb-3 border-b border-slate-100">
            {navLinks.map((link) => (
              <button
                key={link.path}
                type="button"
                onClick={() => {
                  onNavigate(link.path);
                  setMobileMenuOpen(false);
                }}
                className={`text-left px-3 py-2 rounded-lg text-sm font-semibold ${
                  currentPath === link.path ? 'bg-blue-50 text-[#002B49]' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            {isAuthenticated && user ? (
              <>
                <Button
                  variant="gov"
                  size="md"
                  onClick={() => {
                    handleOpenWorkspace();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full bg-[#002B49]"
                >
                  My Workspace
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-rose-700 border-rose-200"
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    onNavigate('/login');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full"
                >
                  Login
                </Button>
                <Button
                  variant="gov"
                  size="md"
                  onClick={() => {
                    onNavigate('/register/agency');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full bg-[#002B49]"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
