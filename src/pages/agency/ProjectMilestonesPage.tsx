import React, { useState } from 'react';
import {
  FolderKanban,
  Camera,
  Upload,
  CheckCircle2,
  Clock,
  MapPin,
  FileCheck2,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { useToast } from '../../context/ToastContext';
import { mockProjects } from '../../data/mockData';
import { Project } from '../../types';

export const ProjectMilestonesPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [projects] = useState<Project[]>(mockProjects.slice(0, 3));
  const [uploadProject, setUploadProject] = useState<Project | null>(null);
  const [milestoneStage, setMilestoneStage] = useState('Plinth / Foundation Completed');
  const [completionNotes, setCompletionNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadProof = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setUploadProject(null);
      showToast('Milestone Uploaded & GPS Tagged', {
        message: 'Photographic evidence with EXIF verification sent to District Nodal Officer.',
        type: 'success',
      });
      setCompletionNotes('');
    }, 600);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active Project Milestone Submissions"
        subtitle="Submit proof of physical completion with geo-tagged images to unlock milestone payments."
      />

      <div className="space-y-4">
        {projects.map((project) => (
          <Card key={project.id} className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-500">{project.projectCode}</span>
                  <StatusBadge status={project.status} size="sm" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">{project.title}</h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  Location: {project.district}, {project.state} • Recommending MP: {project.mpName}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold text-slate-900">
                  ₹ {(project.sanctionedBudget / 10000000).toFixed(2)} Cr
                </div>
                <div className="text-[11px] text-slate-500">Target: {project.targetCompletionDate}</div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <ProgressBar
                label="Physical Milestone Progress"
                value={project.physicalProgress}
                color="emerald"
                size="md"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                Disbursed to Date: <strong className="text-slate-800">₹ {(project.amountDisbursed / 10000000).toFixed(2)} Cr</strong> ({project.financialProgress}%)
              </div>
              <Button
                variant="gov"
                size="sm"
                icon={Camera}
                onClick={() => setUploadProject(project)}
              >
                Upload Geo-Tagged Milestone Proof
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal: Upload Proof Wizard */}
      <Modal
        isOpen={Boolean(uploadProject)}
        onClose={() => setUploadProject(null)}
        maxWidth="lg"
        title="Submit Milestone Evidence (Geo-Tag Verification)"
        description={`Project: ${uploadProject?.projectCode} (${uploadProject?.title})`}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadProject(null)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              variant="gov"
              size="sm"
              onClick={handleUploadProof}
              isLoading={isUploading}
              icon={Upload}
            >
              Submit Evidence Dossier
            </Button>
          </>
        }
      >
        <form onSubmit={handleUploadProof} className="space-y-4">
          <Select
            label="Milestone Completion Stage"
            value={milestoneStage}
            onChange={(e) => setMilestoneStage(e.target.value)}
            options={[
              { label: 'Plinth / Foundation Stage (25%)', value: 'Plinth / Foundation Stage' },
              { label: 'Superstructure & Roofing (50%)', value: 'Superstructure & Roofing' },
              { label: 'Finishing & Electrical/Sanitary (75%)', value: 'Finishing & Electrical/Sanitary' },
              { label: 'Final Commissioning & Handover (100%)', value: 'Final Commissioning & Handover' },
            ]}
          />

          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-slate-400 bg-slate-50/50 cursor-pointer">
            <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <div className="text-xs font-bold text-slate-800">Upload Site Progress Images (JPEG/PNG)</div>
            <div className="text-[10px] text-slate-500 mt-1">
              Camera EXIF location metadata will be validated against registered GIS boundary coordinates.
            </div>
          </div>

          <Textarea
            label="Site Engineer Inspection Notes"
            rows={3}
            value={completionNotes}
            onChange={(e) => setCompletionNotes(e.target.value)}
            placeholder="Report material cube strength tests, structural inspection dates, and engineer in-charge signoff..."
          />
        </form>
      </Modal>
    </div>
  );
};
