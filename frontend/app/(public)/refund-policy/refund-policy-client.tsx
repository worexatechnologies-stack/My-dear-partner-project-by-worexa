'use client';

import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle, ShieldCheck, Mail, Phone, MapPin, Search,
  ChevronDown, ChevronUp, FileText, CreditCard, Clock, Ban,
  RefreshCw, AlertTriangle, ArrowRight, Receipt
} from 'lucide-react';

export default function RefundPolicyClient() {
  const [activeSection, setActiveSection] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const sectionRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const sections = [
    {
      num: 1,
      title: 'Overview',
      icon: FileText,
      gradient: 'from-rose-500 to-pink-600',
      color: '#e11d48',
      bg: '#fff1f2',
      border: '#fecdd3',
      content: 'At My Dear Partner, operated by Worexa Technologies, we strive to provide a reliable digital matchmaking platform. Because our platform grants instant access to premium digital features, contact databases, and communication channels upon payment, membership subscriptions are generally non-refundable, except under specific conditions outlined in this policy.',
      bullets: []
    },
    {
      num: 2,
      title: 'Subscription Cancellation Policy',
      icon: Clock,
      gradient: 'from-amber-500 to-orange-600',
      color: '#d97706',
      bg: '#fffbeb',
      border: '#fef3c7',
      content: 'Members may cancel their paid subscription auto-renewal at any time.',
      bullets: [
        'How to Cancel: You can cancel auto-renewal through your profile account settings or by emailing customer support at Worexatechnologies@gmail.com.',
        'Effect of Cancellation: Upon cancellation, your paid membership will remain active until the end of your current billing cycle. You will continue to have access to paid features until that period expires.',
        'No Partial Billing Credits: Canceling mid-cycle stops future charges but does not automatically trigger a prorated refund for the remaining days of the current subscription term.'
      ]
    },
    {
      num: 3,
      title: 'Refund Eligibility Criteria',
      icon: ShieldCheck,
      gradient: 'from-emerald-500 to-teal-600',
      color: '#10b981',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      content: 'Worexa Technologies will issue a refund only under the following specific circumstances:',
      bullets: [
        'Duplicate or Over-Charged Payments: If your payment method was billed twice due to a technical error, payment gateway glitch, or network lag during checkout, the excess amount will be refunded in full.',
        'Failed Activation / Technical Non-Delivery: If payment was debited from your bank account or card, but your subscription was not activated within 24 hours, and our technical team is unable to resolve the issue, you are eligible for a 100% refund.',
        'Immediate Request Without Feature Usage: If you request a cancellation within 24 hours of purchase AND have not unlocked, viewed, or contacted any profile details or used any premium credits, a refund may be granted, minus applicable transaction processing fees (up to 5%).'
      ]
    },
    {
      num: 4,
      title: 'Non-Refundable Scenarios',
      icon: Ban,
      gradient: 'from-red-500 to-rose-700',
      color: '#ef4444',
      bg: '#fef2f2',
      border: '#fee2e2',
      content: 'Refund requests will NOT be approved under the following conditions:',
      bullets: [
        'Feature Utilization: You have viewed or unlocked profile contact details, sent interests/messages, or utilized any portion of your subscription credits.',
        'Account Termination Due to Policy Violation: If your profile is suspended, blocked, or permanently deleted by Worexa Technologies due to fraudulent activity, fake identity, harassment, or violation of our Terms of Service.',
        'Change of Mind: Simply deciding not to use the platform after purchasing a plan and accessing premium features.',
        'Unsuccessful Matchmaking: Worexa Technologies does not guarantee marriage outcomes or mutual match acceptances. Inability to find a match does not constitute grounds for a refund.'
      ]
    },
    {
      num: 5,
      title: 'How to Request a Refund',
      icon: Mail,
      gradient: 'from-violet-500 to-purple-600',
      color: '#8b5cf6',
      bg: '#faf5ff',
      border: '#e9d5ff',
      content: 'To request a refund, please send an email to Worexatechnologies@gmail.com with the subject line "Refund Request - [Your Registered Phone Number / Profile ID]", including:',
      bullets: [
        'Full Name',
        'Registered Phone Number / Email ID',
        'Transaction ID / Order ID',
        'Payment Date and Amount',
        'Detailed reason for the refund request (attach screenshots if applicable)'
      ]
    },
    {
      num: 6,
      title: 'Processing Time & Method',
      icon: RefreshCw,
      gradient: 'from-cyan-500 to-blue-600',
      color: '#06b6d4',
      bg: '#ecfeff',
      border: '#cffafe',
      content: 'Refund requests are reviewed and verified within 48 business hours of receipt. Approved refunds will be credited back exclusively to the original payment source (Credit Card, Debit Card, UPI, or Net Banking) used during purchase. Once processed, funds typically reflect in your account within 5 to 7 working days.',
      bullets: []
    }
  ];

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    };

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const num = parseInt(entry.target.id.replace('section-', ''));
          if (!isNaN(num)) {
            setActiveSection(num);
          }
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, observerOptions);
    Object.values(sectionRefs.current).forEach(ref => {
      if (ref) observer.observe(ref);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (num: number) => {
    setActiveSection(num);
    setIsMobileMenuOpen(false);
    const element = document.getElementById(`section-${num}`);
    if (element) {
      const offset = 100;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
    }
  };

  const filteredSections = sections.filter(sec =>
    sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sec.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sec.bullets.some(b => b.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <main className="min-h-screen pt-24 sm:pt-28 pb-16 bg-gradient-to-b from-[#fdfcfb] to-[#f4f1eb]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Page Header */}
        <div className="text-center mb-10 sm:mb-16">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#be123c]/10 text-[#be123c] mb-4 uppercase tracking-widest border border-[#be123c]/20">
            Refund & Cancellation Policy
          </span>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[var(--theme-primary-800)] font-display tracking-tight mb-4">
            Refund & Cancellation Policy
          </h1>
          <p className="text-slate-500 text-sm sm:text-base font-medium">
            Last Updated: July 28, 2026
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600">
            <Receipt className="w-4 h-4" />
            Doc Ref: WT/MDP/COMP/2026/01 &nbsp;|&nbsp; Platform: My Dear Partner &nbsp;|&nbsp; Operated By: Worexa Technologies (worexa.in)
          </div>
        </div>

        {/* Mobile Search & Navigation */}
        <div className="lg:hidden mb-6 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Policy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 text-slate-700 pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#be123c]/20 focus:border-[#be123c] text-sm"
            />
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm font-semibold"
          >
            <span>Jump to Section: {sections.find(s => s.num === activeSection)?.title}</span>
            {isMobileMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {isMobileMenuOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 max-h-60 overflow-y-auto">
              {sections.map((sect) => (
                <button
                  key={sect.num}
                  onClick={() => scrollToSection(sect.num)}
                  className={`text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeSection === sect.num ? 'bg-[#be123c] text-white' : 'bg-slate-50 text-slate-650 hover:bg-slate-100'}`}
                >
                  Section {sect.num}. {sect.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Layout Grid */}
        <div className="grid lg:grid-cols-[280px_1fr] gap-8 items-start">

          {/* Sidebar */}
          <aside className="hidden lg:block sticky top-28 bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-5 max-h-[calc(100vh-140px)] flex flex-col">
            <div>
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-2">Search Policy</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter sections..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 text-slate-700 pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#be123c]/20 focus:border-[#be123c] text-xs"
                />
              </div>
            </div>
            <div className="flex-grow overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 sticky top-0 bg-white py-1">Table of Contents</h3>
              {filteredSections.map((sect) => {
                const IconComponent = sect.icon;
                const isActive = activeSection === sect.num;
                return (
                  <button
                    key={sect.num}
                    onClick={() => scrollToSection(sect.num)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${isActive ? 'bg-[#be123c] text-white shadow-md shadow-[#be123c]/15' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                  >
                    <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-450'}`} />
                    <span className="text-xs font-bold leading-tight truncate">{sect.num}. {sect.title}</span>
                  </button>
                );
              })}
              {filteredSections.length === 0 && (
                <div className="text-slate-400 text-xs py-4 text-center">No matching sections.</div>
              )}
            </div>
          </aside>

          {/* Content */}
          <div className="space-y-6 sm:space-y-8">

            {/* Intro Card */}
            <div className="bg-white/80 border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-sm backdrop-blur-md">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                  <Receipt className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <p className="text-gray-700 text-sm sm:text-base leading-relaxed">
                    At <strong>My Dear Partner</strong>, operated by <strong>Worexa Technologies (worexa.in)</strong>, we strive to provide a reliable digital matchmaking platform. This policy outlines the terms regarding subscription cancellations, refunds, and billing. For any queries, contact us at <strong>Worexatechnologies@gmail.com</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-6">
              {filteredSections.map((sect) => {
                const IconComponent = sect.icon;
                const isActive = activeSection === sect.num;
                return (
                  <div
                    key={sect.num}
                    id={`section-${sect.num}`}
                    ref={(el) => { sectionRefs.current[sect.num] = el; }}
                    className={`bg-white border rounded-3xl p-6 sm:p-8 shadow-sm transition-all duration-300 relative overflow-hidden ${isActive ? 'border-[#be123c]/30 shadow-md' : 'border-slate-100'}`}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-bl-full -z-10" />
                    <div className="flex flex-col sm:flex-row gap-5 items-start">
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 text-white shadow-md bg-gradient-to-br ${sect.gradient}`}>
                        <IconComponent className="w-6 h-6 sm:w-7 sm:h-7" />
                      </div>
                      <div className="flex-grow w-full">
                        <div className="flex flex-wrap gap-2 items-center mb-3">
                          <span className="text-xs font-black uppercase px-2 py-0.5 rounded-full border" style={{ backgroundColor: sect.bg, borderColor: sect.border, color: sect.color }}>
                            Section {sect.num}
                          </span>
                          <h2 className="text-lg sm:text-xl font-extrabold text-[var(--theme-primary-800)] font-display">{sect.title}</h2>
                        </div>
                        <div className="space-y-3">
                          <p className="text-gray-700 text-sm sm:text-base leading-relaxed text-justify">{sect.content}</p>
                          {sect.bullets.length > 0 && (
                            <ul className="space-y-2 mt-3">
                              {sect.bullets.map((bullet, bIdx) => (
                                <li key={bIdx} className="flex gap-2.5 items-start text-gray-700 text-sm sm:text-base">
                                  <CheckCircle className="w-4 h-4 text-[#be123c] shrink-0 mt-1" />
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredSections.length === 0 && (
                <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center text-slate-400">
                  No matching policy sections found for &ldquo;{searchQuery}&rdquo;.
                </div>
              )}
            </div>

            {/* Contact Section */}
            <div className="bg-gradient-to-br from-[#be123c] to-[#9f1239] text-white rounded-3xl p-6 sm:p-8 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_70%)] pointer-events-none" />
              <div className="relative z-10 flex flex-col sm:flex-row gap-6 items-start">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                  <Mail className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-white/20 border border-white/10 text-amber-200">Contact</span>
                    <h2 className="text-lg sm:text-xl font-extrabold font-display">Contact Us</h2>
                  </div>
                  <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-6">
                    If you have questions regarding this Refund & Cancellation Policy, please reach out to us.
                  </p>
                  <div className="grid gap-3.5 sm:grid-cols-2 text-sm">
                    <div className="flex items-center gap-2.5 bg-white/10 rounded-xl px-4 py-3 border border-white/10">
                      <Mail className="w-4 h-4 text-amber-300 shrink-0" />
                      <div>
                        <div className="text-[10px] text-white/60 font-black uppercase tracking-wider">Email</div>
                        <a href="mailto:Worexatechnologies@gmail.com" className="font-bold hover:underline">Worexatechnologies@gmail.com</a>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 bg-white/10 rounded-xl px-4 py-3 border border-white/10 sm:col-span-2">
                      <MapPin className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[10px] text-white/60 font-black uppercase tracking-wider">Operated By</div>
                        <span className="font-semibold leading-relaxed">Worexa Technologies (worexa.in)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}