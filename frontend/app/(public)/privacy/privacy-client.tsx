'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Database, Eye, Share2, Lock, Cookie, Clock,
  Fingerprint, Ban, ExternalLink, RefreshCw, Mail, MapPin, CheckCircle, Search, ChevronDown, ChevronUp, ShieldCheck, FileText
} from 'lucide-react';

export default function PrivacyClient() {
  const [activeSection, setActiveSection] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const sectionRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const sections = [
    {
      num: 1,
      title: 'Introduction',
      icon: ShieldCheck,
      gradient: 'from-rose-500 to-pink-600',
      color: '#e11d48',
      bg: '#fff1f2',
      border: '#fecdd3',
      content: 'Worexa Technologies respects your privacy and is committed to protecting the personal data of all users registered on My Dear Partner. This Privacy Policy explains how we collect, use, process, store, and safeguard your personal information in compliance with the Digital Personal Data Protection (DPDP) Act and applicable Information Technology regulations.',
      bullets: []
    },
    {
      num: 2,
      title: 'Information We Collect',
      icon: Database,
      gradient: 'from-rose-500 to-pink-600',
      color: '#e11d48',
      bg: '#fff1f2',
      border: '#fecdd3',
      content: 'We collect information that you voluntarily provide to us when setting up an account, as well as technical data automatically generated during your platform usage:',
      bullets: [
        'Personal Profile Data: Name, age, gender, date of birth, religion, caste, mother tongue, height, education, occupation, income bracket, family details, photos, and personal bio.',
        'Contact Information: Email address, mobile phone number, and physical address.',
        'Verification Data: Government-issued ID proofs (Aadhaar, PAN, Passport) uploaded strictly for identity verification.',
        'Technical & Usage Data: IP address, device model, operating system, app analytics, login timestamps, and chat activity metadata.'
      ]
    },
    {
      num: 3,
      title: 'How We Use Your Data',
      icon: Eye,
      gradient: 'from-emerald-500 to-teal-600',
      color: '#10b981',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      content: 'Worexa Technologies uses your personal information for the following legitimate purposes:',
      bullets: [
        'To create and maintain your profile on My Dear Partner.',
        'To display relevant matrimonial recommendations and facilitate communication between members.',
        'To verify member identities and prevent fraud, fake accounts, and platform misuse.',
        'To process subscription transactions and issue invoices.',
        'To send operational notifications, updates, and customer support communications.'
      ]
    },
    {
      num: 4,
      title: 'Data Sharing & Disclosure',
      icon: Share2,
      gradient: 'from-amber-500 to-orange-600',
      color: '#f59e0b',
      bg: '#fffbeb',
      border: '#fef3c7',
      content: 'We value your privacy and do not sell your personal data to third-party advertisers. We share information only under the following circumstances:',
      bullets: [
        'With Other Members: Your public profile details (excluding direct phone numbers and emails unless unlocked via subscription/mutual consent) are visible to registered members on My Dear Partner.',
        'Authorized Service Providers: Trusted third-party vendors who assist us in operating our platform, such as payment gateways, SMS/OTP service providers, cloud hosting servers, and ID verification partners.',
        'Legal Requirements: When required by law, court orders, or government authorities for criminal investigations or legal proceedings.'
      ]
    },
    {
      num: 5,
      title: 'Data Security & Storage',
      icon: Lock,
      gradient: 'from-rose-500 to-red-600',
      color: '#f43f5e',
      bg: '#fff1f2',
      border: '#fecdd3',
      content: 'All data transmitted through My Dear Partner is protected using standard SSL/TLS encryption protocols. User data is stored securely on servers located in compliance with local data localization standards. We implement administrative, technical, and physical safeguards to prevent unauthorized access, loss, or misuse of your personal data.',
      bullets: []
    },
    {
      num: 6,
      title: 'User Rights & Data Control',
      icon: Fingerprint,
      gradient: 'from-teal-500 to-cyan-600',
      color: '#0d9488',
      bg: '#f0fdfa',
      border: '#ccfbf1',
      content: 'You have the following rights regarding your personal data:',
      bullets: [
        'Access & Correction: You can review and edit your personal details directly through your account settings.',
        'Consent Withdrawal & Deletion: You can request account deletion at any time through the app/website settings or by contacting customer support. Upon deletion, your profile will be removed from search results, and data will be permanently purged or anonymized in accordance with statutory retention periods.'
      ]
    },
    {
      num: 7,
      title: 'Cookies and Analytics',
      icon: Cookie,
      gradient: 'from-emerald-600 to-teal-700',
      color: '#059669',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      content: 'My Dear Partner uses cookies and similar technologies to improve performance, remember user preferences, analyze visitor behaviour, and enhance overall browsing. You can control cookie settings in your browser.',
      bullets: []
    },
    {
      num: 8,
      title: 'Data Retention',
      icon: Clock,
      gradient: 'from-violet-500 to-purple-600',
      color: '#8b5cf6',
      bg: '#faf5ff',
      border: '#e9d5ff',
      content: 'We retain your information only as long as necessary to provide our services, meet legal obligations, resolve disputes, or prevent fraud. Upon permanent account deletion, personal info is removed or anonymized except where retention is legally required.',
      bullets: []
    },
    {
      num: 9,
      title: "Children's Privacy",
      icon: Ban,
      gradient: 'from-red-500 to-rose-700',
      color: '#ef4444',
      bg: '#fef2f2',
      border: '#fee2e2',
      content: 'My Dear Partner is intended only for individuals who have reached the legal marriageable age under applicable laws. We do not knowingly collect personal information from minors. If such information is discovered, it will be removed promptly.',
      bullets: []
    },
    {
      num: 10,
      title: 'Third-Party Links',
      icon: ExternalLink,
      gradient: 'from-rose-400 to-pink-500',
      color: '#fb7185',
      bg: '#f8fafc',
      border: '#f1f5f9',
      content: 'Our platform may contain links to third-party websites or services. We are not responsible for the privacy practices, content, or policies of external websites. Users are encouraged to review the privacy policies of any third-party services they visit.',
      bullets: []
    },
    {
      num: 11,
      title: 'Changes to This Privacy Policy',
      icon: RefreshCw,
      gradient: 'from-teal-400 to-cyan-500',
      color: '#2dd4bf',
      bg: '#f0fdfa',
      border: '#ccfbf1',
      content: 'We may update this Privacy Policy periodically to reflect changes in our services, legal requirements, or operational practices. Any updates will be posted on this page along with the revised effective date. Continued use of My Dear Partner after such changes constitutes acceptance of the updated Privacy Policy.',
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
    <main className="min-h-screen bg-[#fffefd] pb-20 pt-20 sm:pt-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
        
        {/* Page Header */}
        <div className="relative mb-10 overflow-hidden border-b border-[#eaded8] bg-[#f4eee8] px-6 py-12 sm:mb-14 sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#dce4d5]" />
          <div className="relative max-w-2xl">
            <span className="font-display text-[10px] font-bold uppercase tracking-[.32em] text-[#bd6970]">Your privacy, explained</span>
            <h1 className="mt-5 font-display text-5xl font-light leading-[.94] tracking-[-.06em] text-[#2c2928] sm:text-6xl">Privacy <em className="font-serif font-normal text-[#bd6970]">Policy.</em></h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-stone-600 sm:text-base">The personal details you share matter. This policy explains what we collect, why we use it, and the choices you have along the way.</p>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-stone-500"><span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-[#bd6970]" /> Updated July 28, 2026</span><span>Data fiduciary: Worexa Technologies</span></div>
          </div>
        </div>

        {/* Mobile Search & Navigation */}
        <div className="mb-6 space-y-3 border border-[#eaded8] bg-[#fffaf7] p-4 lg:hidden">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search Privacy..." 
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
          
          {/* Sidebar */}
          <aside className="sticky top-28 hidden max-h-[calc(100vh-140px)] flex-col space-y-5 border-l border-[#eaded8] pl-5 lg:flex">
            <div>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#bd6970]">Search policy</h3>
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
          <div className="space-y-8">
            
            {/* Intro Card */}
            <div className="border-l-2 border-[#bd6970] bg-[#fffaf7] p-6 sm:p-8">
              <p className="mb-4 text-sm leading-7 text-stone-700 sm:text-base">
                At <strong>My Dear Partner</strong>, your privacy is fundamental to the trust we strive to build. We understand that the information you share while searching for a life partner is personal and sensitive. This Privacy Policy explains how we collect, use, protect, and disclose your information when you use our website, mobile application, and related services.
              </p>
              <p className="text-sm font-bold leading-7 text-stone-700 sm:text-base">
                By using My Dear Partner, you agree to the practices described in this Privacy Policy.
              </p>
            </div>

            {/* Sections */}
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
                    <div className="absolute right-0 top-0 -z-10 h-20 w-20 bg-[#f7e7e2] [clip-path:polygon(100%_0,0_0,100%_100%)]" />
                    <div className="flex flex-col sm:flex-row gap-5 items-start">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f7e7e2] text-[#bd6970] sm:h-14 sm:w-14">
                        <IconComponent className="w-6 h-6 sm:w-7 sm:h-7" />
                      </div>
                      <div className="flex-grow w-full">
                        <div className="flex flex-wrap gap-2 items-center mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#bd6970]">
                            Section {sect.num}
                          </span>
                          <h2 className="font-display text-xl font-light text-[#2c2928] sm:text-2xl">{sect.title}</h2>
                        </div>
                        <div className="space-y-3">
                          <p className="text-sm leading-7 text-stone-600 sm:text-base">{sect.content}</p>
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

            {/* Contact Section */}
            <div className="relative overflow-hidden bg-[#2c2928] p-7 text-white sm:p-9">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_70%)] pointer-events-none" />
              <div className="relative z-10 flex flex-col sm:flex-row gap-6 items-start">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 sm:h-14 sm:w-14">
                  <Mail className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#f0c4c5]">Contact</span>
                    <h2 className="text-lg sm:text-xl font-extrabold font-display">Contact Us</h2>
                  </div>
                  <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-6">
                    If you have questions, concerns, or requests regarding this Privacy Policy or your personal information, please reach out to us.
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
                        <div className="text-[10px] text-white/60 font-black uppercase tracking-wider">Data Fiduciary</div>
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
