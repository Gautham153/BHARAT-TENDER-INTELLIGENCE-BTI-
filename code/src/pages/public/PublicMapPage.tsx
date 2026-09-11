import React, { useState } from 'react';
import { MapPin, Search, Filter, Layers, Info, CheckCircle2, ChevronRight } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ProjectMap } from '../../components/maps/ProjectMap';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { RiskBadge } from '../../components/ui/RiskBadge';
import { SearchBar } from '../../components/ui/SearchBar';
import { mockProjects } from '../../data/mockData';
import { Project } from '../../types';

export const PublicMapPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(mockProjects[0]);
  const [sectorFilter, setSectorFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = mockProjects.filter((p) => {
    if (sectorFilter !== 'All' && p.category !== sectorFilter) return false;
    if (stateFilter !== 'All' && p.state !== stateFilter) return false;
    if (
      searchQuery &&
      !p.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !p.district.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !p.mpName.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="National MPLAD GIS Asset Registry"
        subtitle="Explore geo-tagged community assets, sanctioned budgets, and physical verification across parliamentary constituencies."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Interactive Map Container */}
        <div className="lg:col-span-8 space-y-4">
          <ProjectMap
            projects={filteredProjects}
            selectedProject={selectedProject}
            onSelectProject={(p) => setSelectedProject(p)}
            height="560px"
          />

          <div className="flex items-center justify-between text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-200">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Completed Works
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block ml-2" /> In Progress
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block ml-2" /> Delayed / Audit
            </span>
            <span>Survey of India / NIC GIS Datum Compatible</span>
          </div>
        </div>

        {/* Right Side: Project Details & Filter Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {/* Filter Bar */}
          <Card padding="sm" className="space-y-2.5">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by constituency or MP..."
            />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-700 outline-none"
              >
                <option value="All">All States</option>
                <option value="Uttar Pradesh">Uttar Pradesh</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="Rajasthan">Rajasthan</option>
                <option value="Bihar">Bihar</option>
              </select>

              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-700 outline-none"
              >
                <option value="All">All Sectors</option>
                <option value="Healthcare Infrastructure">Healthcare</option>
                <option value="Rural Road Construction">Rural Roads</option>
                <option value="Drinking Water Project">Water Schemes</option>
                <option value="Community Infrastructure">Community</option>
              </select>
            </div>
          </Card>

          {/* Selected Asset Spotlight */}
          {selectedProject ? (
            <Card className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-xs font-bold text-slate-500">{selectedProject.projectCode}</span>
                  <h3 className="font-bold text-slate-900 text-sm mt-0.5">{selectedProject.title}</h3>
                  <div className="text-xs text-slate-500">{selectedProject.district}, {selectedProject.state}</div>
                </div>
                <StatusBadge status={selectedProject.status} size="sm" />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <ProgressBar
                  label="Physical Execution Progress"
                  value={selectedProject.physicalProgress}
                  color="emerald"
                  size="sm"
                />
              </div>

              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Sanctioned Outlay:</span>
                  <strong className="text-slate-900">
                    ₹ {(selectedProject.sanctionedBudget / 10000000).toFixed(2)} Cr
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Recommending MP:</span>
                  <strong className="text-slate-900">{selectedProject.mpName}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Executing Contractor:</span>
                  <strong className="text-slate-900">{selectedProject.executingAgencyName}</strong>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Target Date:</span>
                  <strong className="text-slate-900">{selectedProject.targetCompletionDate}</strong>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => onNavigate('/transparency')}
              >
                View Public Audit Record & Ledger
              </Button>
            </Card>
          ) : (
            <Card className="p-8 text-center text-slate-500 text-xs">
              Click any project pin on the GIS map to inspect sanctioned outlay and progress.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
