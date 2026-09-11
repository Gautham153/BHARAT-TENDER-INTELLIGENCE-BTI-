import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, MessageSquare, ShieldCheck } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { useToast } from '../../context/ToastContext';

export const ContactPage: React.FC = () => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Message Transmitted', {
      message: 'Your inquiry has been received by the Central BTI Support Desk.',
      type: 'success',
    });
    setFormData({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      <div className="text-center space-y-3">
        <span className="text-xs font-bold uppercase tracking-widest text-[#002B49] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
          Official Support Directory
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Contact Bharat Tender Intelligence Support Desk
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl mx-auto">
          Get in touch with the technical support desk, state nodal coordinators, or vigilance escalation team.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-5 text-center space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 text-[#002B49] flex items-center justify-center">
            <Phone className="w-5 h-5" />
          </div>
          <div className="font-bold text-slate-900 text-sm">National Toll-Free Helpline</div>
          <div className="text-xs text-slate-600 font-mono">1800-11-2024 / 011-2338-9821</div>
          <div className="text-[11px] text-slate-400">Mon-Fri 09:30 - 18:00 IST</div>
        </Card>

        <Card className="p-5 text-center space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 text-[#002B49] flex items-center justify-center">
            <Mail className="w-5 h-5" />
          </div>
          <div className="font-bold text-slate-900 text-sm">Official Email</div>
          <div className="text-xs text-slate-600 font-mono">support@bti.gov.in</div>
          <div className="text-[11px] text-slate-400">Response within 24 business hours</div>
        </Card>

        <Card className="p-5 text-center space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 text-[#002B49] flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="font-bold text-slate-900 text-sm">Nodal Headquarters</div>
          <div className="text-xs text-slate-600">Sardar Patel Bhavan, Sansad Marg</div>
          <div className="text-[11px] text-slate-400">New Delhi - 110001, India</div>
        </Card>
      </div>

      {/* Inquiry Form */}
      <Card className="p-8">
        <h3 className="text-base font-bold text-slate-900 mb-4">Send a Direct Administrative Message</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Your Full Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Dr. Ramesh Gupta"
            />
            <Input
              label="Official Email Address"
              required
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. ramesh.gupta@gov.in"
            />
          </div>
          <Input
            label="Subject"
            required
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder="e.g. Inquiry regarding API integration for District Nodal Officers"
          />
          <Textarea
            label="Message Details"
            required
            rows={4}
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            placeholder="Provide context and details..."
          />
          <Button variant="gov" size="md" icon={Send} type="submit">
            Transmit Official Message
          </Button>
        </form>
      </Card>
    </div>
  );
};
