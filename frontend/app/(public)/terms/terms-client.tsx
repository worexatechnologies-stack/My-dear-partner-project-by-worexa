'use client';

import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle, UserCheck, Key, FileText, AlertOctagon, Lock,
  ShieldCheck, MessageSquare, Crown, CreditCard, ShieldAlert, Award,
  Ban, Scale, ExternalLink, RefreshCw, Gavel, Mail, MapPin, Phone, Search, ChevronDown, ChevronUp
} from 'lucide-react';

export default function TermsClient() {
  const [activeSection, setActiveSection] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const sectionRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const sections = [
    {
      num: 1,
      title: 'Acceptance of Terms',
      icon: CheckCircle,
      gradient: 'from-emerald-500 to-teal-600',
      color: '#10b981',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      content: 'By accessing or registering on My Dear Partner (hereafter referred to as the "Platform"), owned and operated by Worexa Technologies ("Company", "We", "Us", or "Our"), you ("User" or "Member") agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must not use our services.',
      bullets: []
    },
    {
      num: 2,
      title: 'Eligibility Criteria',
      icon: UserCheck,
      gradient: 'from-rose-500 to-red-600',
      color: '#f43f5e',
      bg: '#fff1f2',
      border: '#fecdd3',
      content: 'To register as a member of My Dear Partner or use the Platform, you must meet the following legal requirements:',
      bullets: [
        'Legal Age: You must be of legal marriageable age as per the laws of your jurisdiction (e.g., minimum 18 years for females and 21 years for males in India).',
        'Marital Status: You must be legally single, divorced, widowed, or legally separated. Married individuals are strictly prohibited from creating profiles.',
        'Legal Capacity: You must be legally competent to enter into a binding contract and not barred by any applicable law.'
      ]
    },
    {
      num: 3,
      title: 'Account Registration & Authenticity',
      icon: Key,
      gradient: 'from-rose-500 to-pink-600',
      color: '#e11d48',
      bg: '#fff1f2',
      border: '#fecdd3',
      content: 'You agree to provide true, accurate, current, and complete information during registration and keep your profile updated. Creating duplicate profiles, false accounts, or profiles on behalf of third parties without their explicit legal consent is strictly prohibited. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.',
      bullets: []
    },
    {
      num: 4,
      title: 'Code of Conduct',
      icon: AlertOctagon,
      gradient: 'from-red-500 to-rose-700',
      color: '#ef4444',
      bg: '#fef2f2',
      border: '#fee2e2',
      content: 'All members must interact respectfully and lawfully. Harassment, hate speech, fraudulent behaviour, solicitation, or any activity that violates applicable laws or infringes upon the rights of others is strictly prohibited and will result in immediate account suspension or permanent ban.',
      bullets: []
    },
    {
      num: 5,
      title: 'Platform Role & Disclaimer',
      icon: ShieldAlert,
      gradient: 'from-orange-500 to-red-600',
      color: '#f97316',
      bg: '#fff7ed',
      border: '#ffedd5',
      content: 'My Dear Partner operates purely as an online intermediary platform for matrimonial matchmaking. We do not guarantee marriage outcomes or match compatibility. While we implement OTP and optional Government ID verification processes, Worexa Technologies does not conduct full criminal background checks on every user. Users are strongly advised to independently verify the credentials, character, family details, and background of any match before proceeding with personal meetings or financial decisions.',
      bullets: []
    },
    {
      num: 6,
      title: 'Paid Subscriptions & Payment Terms',
      icon: CreditCard,
      gradient: 'from-rose-600 to-pink-600',
      color: '#e11d48',
      bg: '#f8fafc',
      border: '#e2e8f0',
      content: 'Certain premium features (e.g., contacting matches directly, viewing full contact details) require a paid subscription. All fees are non-refundable except as expressly stated in our Refund & Cancellation Policy. Payments are processed through third-party gateways and are subject to their terms.',
      bullets: []
    },
    {
      num: 7,
      title: 'Limitation of Liability',
      icon: Scale,
      gradient: 'from-slate-600 to-slate-800',
      color: '#475569',
      bg: '#f8fafc',
      border: '#f1f5f9',
      content: 'To the maximum extent permitted by applicable law, Worexa Technologies shall not be liable for any direct, indirect, incidental, or consequential damages resulting from your use of the Platform, interactions with other members, or inability to find a match.',
      bullets: []
    },
    {
      num: 8,
      title: 'Suspension & Termination',
      icon: Ban,
      gradient: 'from-red-600 to-rose-800',
      color: '#dc2626',
      bg: '#fff5f5',
      border: '#fed7d7',
      content: 'We reserve the right to suspend or permanently terminate accounts that violate these terms, provide false profile details, engage in fraud or abuse, or harm the reputation of the platform.',
      bullets: []
    },
    {
      num: 9,
      title: 'Changes to Terms',
      icon: RefreshCw,
      gradient: 'from-teal-400 to-cyan-500',
      color: '#2dd4bf',
      bg: '#f0fdfa',
      border: '#ccfbf1',
      content: 'We may update these Terms & Conditions from time to time. Revised terms become effective immediately upon publication. Continued use of the platform constitutes acceptance of the updated Terms.',
      bullets: []
    },
    {
      num: 10,
      title: 'Governing Law',
      icon: Gavel,
      gradient: 'from-slate-700 to-slate-900',
      color: '#1e293b',
      bg: '#f8fafc',
      border: '#e2e8f0',
      content: 'These Terms & Conditions shall be governed by and interpreted in accordance with the laws of India. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the competent courts located in Bengaluru, Karnataka, unless otherwise required by applicable law.',
      bullets: []
    }
  ];

  // Intersection Observer to highlight sidebar as user scrolls
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
      const offset = 100; // Header spacing offset
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const filteredSections = sections.filter(sec => 
    sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sec.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sec.bullets.some(b => b.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <main className="min-h-screen bg-[#fffefd] pb-20 pt-20 sm:pt-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
        
        {/* Page Header */}
        <div className="relative mb-10 overflow-hidden border-b border-[#eaded8] bg-[#f4eee8] px-6 py-12 sm:mb-14 sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#dce4d5]" />
          <div className="relative max-w-2xl">
            <span className="font-display text-[10px] font-bold uppercase tracking-[.32em] text-[#bd6970]">Legal information</span>
            <h1 className="mt-5 font-display text-5xl font-light leading-[.94] tracking-[-.06em] text-[#2c2928] sm:text-6xl">Terms &amp; <em className="font-serif font-normal text-[#bd6970]">Conditions.</em></h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-stone-600 sm:text-base">Please read these terms carefully. They explain how My Dear Partner works and the shared standards that help keep the community safe and respectful.</p>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-stone-500">
              <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-[#bd6970]" /> Updated July 28, 2026</span>
              <span>Operated by Worexa Technologies</span>
            </div>
          </div>
        </div>

        {/* Search & Mobile Navigation Accordion Bar */}
        <div className="mb-6 space-y-3 border border-[#eaded8] bg-[#fffaf7] p-4 lg:hidden">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search Terms..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-[#eaded8] bg-white py-2.5 pl-10 pr-4 text-sm text-stone-700 focus:border-[#bd6970] focus:outline-none focus:ring-2 focus:ring-[#bd6970]/20"
            />
          </div>
          
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex w-full items-center justify-between border border-[#eaded8] bg-white px-3 py-2.5 text-sm font-semibold text-stone-700"
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
                  className={`px-3 py-2 text-left text-xs font-bold transition-all ${activeSection === sect.num ? 'bg-[#bd6970] text-white' : 'bg-white text-stone-600 hover:bg-[#f7e7e2]'}`}
                >
                  Section {sect.num}. {sect.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Layout Grid */}
        <div className="grid items-start gap-10 lg:grid-cols-[240px_1fr]">
          
          {/* Left Column: Sticky Sidebar Index */}
          <aside className="sticky top-28 hidden max-h-[calc(100vh-140px)] flex-col space-y-5 border-l border-[#eaded8] pl-5 lg:flex">
            <div>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#bd6970]">Search terms</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Filter sections..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border-b border-[#eaded8] bg-transparent py-2 pl-9 pr-2 text-xs text-stone-700 focus:border-[#bd6970] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-grow overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
              <h3 className="sticky top-0 mb-2 bg-[#fffefd] py-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#bd6970]">Contents</h3>
              {filteredSections.map((sect) => {
                const IconComponent = sect.icon;
                const isActive = activeSection === sect.num;
                return (
                  <button
                    key={sect.num}
                    onClick={() => scrollToSection(sect.num)}
                    className={`flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-all ${isActive ? 'border-[#bd6970] bg-[#f7e7e2] text-[#7d3a44]' : 'border-transparent text-stone-500 hover:border-[#e7b7b8] hover:bg-[#fffaf7] hover:text-stone-800'}`}
                  >
                    <IconComponent className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#bd6970]' : 'text-stone-400'}`} />
                    <span className="text-xs font-bold leading-tight truncate">
                      {sect.num}. {sect.title}
                    </span>
                  </button>
                );
              })}
              {filteredSections.length === 0 && (
                <div className="text-slate-400 text-xs py-4 text-center">No matching sections.</div>
              )}
            </div>
          </aside>

          {/* Right Column: Scrollable Cards Stack */}
          <div className="space-y-8">
            
            {/* Intro Card */}
            <div className="border-l-2 border-[#bd6970] bg-[#fffaf7] p-6 sm:p-8">
              <p className="text-sm leading-7 text-stone-700 sm:text-base">
                Welcome to <strong>My Dear Partner</strong>, owned and operated by <strong>Worexa Technologies (worexa.in)</strong>. These Terms & Conditions govern your access to and use of our website, mobile application, and related services. By creating an account or using our platform, you agree to comply with these Terms. If you do not agree, please refrain from using our services.
              </p>
            </div>

            {/* Stack of Sections */}
            <div className="space-y-4">
              {filteredSections.map((sect) => {
                const IconComponent = sect.icon;
                const isActive = activeSection === sect.num;
                return (
                  <div 
                    key={sect.num} 
                    id={`section-${sect.num}`}
                    ref={(el) => { sectionRefs.current[sect.num] = el; }}
                    className={`relative overflow-hidden border bg-white p-6 transition-all duration-300 sm:p-8 ${isActive ? 'border-[#e7b7b8] shadow-[0_14px_32px_rgba(64,52,43,.08)]' : 'border-[#eaded8]'}`}
                  >
                    {/* Visual Accent Badge */}
                    <div className="absolute right-0 top-0 -z-10 h-20 w-20 bg-[#f7e7e2] [clip-path:polygon(100%_0,0_0,100%_100%)]" />

                    <div className="flex flex-col sm:flex-row gap-5 items-start">
                      {/* Icon Wrapper */}
                      <div 
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f7e7e2] text-[#bd6970] sm:h-14 sm:w-14"
                      >
                        <IconComponent className="w-6 h-6 sm:w-7 sm:h-7" />
                      </div>

                      {/* Content Container */}
                      <div className="flex-grow w-full">
                        <div className="flex flex-wrap gap-2 items-center mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#bd6970]">
                            Section {sect.num}
                          </span>
                          <h2 className="font-display text-xl font-light text-[#2c2928] sm:text-2xl">
                            {sect.title}
                          </h2>
                        </div>
                        
                        <div className="space-y-3">
                          <p className="text-sm leading-7 text-stone-600 sm:text-base">
                            {sect.content}
                          </p>

                          {sect.bullets.length > 0 && (
                            <ul className="space-y-2 mt-3">
                              {sect.bullets.map((bullet, bIdx) => (
                                <li key={bIdx} className="flex items-start gap-2.5 text-sm text-stone-600 sm:text-base">
                                  <CheckCircle className="mt-1 h-4 w-4 shrink-0 text-[#bd6970]" />
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

            {/* Contact Us Section */}
            <div 
              id="section-11"
              className="relative overflow-hidden bg-[#2c2928] p-7 text-white sm:p-9"
            >
              {/* Subtle Ambient Radial */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_70%)] pointer-events-none" />
              
              <div className="relative z-10 flex flex-col sm:flex-row gap-6 items-start">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 sm:h-14 sm:w-14">
                  <Mail className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#f0c4c5]">
                      Contact
                    </span>
                    <h2 className="text-lg sm:text-xl font-extrabold font-display">
                      Contact Us
                    </h2>
                  </div>
                  
                  <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-6">
                    If you have any questions regarding these Terms & Conditions, please feel free to reach out to us.
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
                        <span className="font-semibold leading-relaxed">
                          Worexa Technologies (worexa.in)
                        </span>
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
