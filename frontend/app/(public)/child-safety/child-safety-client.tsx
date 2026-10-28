'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ShieldCheck,
  AlertOctagon,
  Scale,
  Mail,
  MapPin,
  CheckCircle2,
  Lock,
  Flag,
  FileText,
  UserX,
  PhoneCall,
  ExternalLink,
} from 'lucide-react';

export default function ChildSafetyClient() {
  const [activeTab, setActiveTab] = useState<string>('all');

  const policies = [
    {
      id: 'csae-zero-tolerance',
      num: '01',
      title: 'Zero-Tolerance Policy on CSAE & CSAM',
      icon: ShieldAlert,
      badge: 'Critical Standard',
      badgeColor: 'bg-red-50 text-red-700 border-red-200',
      description:
        'Worexa Technologies and My Dear Partner maintain an absolute, non-negotiable zero-tolerance policy regarding Child Sexual Abuse and Exploitation (CSAE) and Child Sexual Abuse Material (CSAM).',
      points: [
        'Strict Prohibition: Any creation, possession, dissemination, uploading, streaming, solicitation, or facilitation of Child Sexual Abuse Material (CSAM) or any content depicting Child Sexual Abuse and Exploitation (CSAE) is strictly prohibited.',
        'Zero Tolerance for Grooming: Any behavior aimed at establishing an emotional connection with a minor to lower inhibitions for sexual exploitation, abuse, trafficking, or illegal contact is strictly forbidden and immediately reported to authorities.',
        'No Sexualization of Minors: Displaying, sharing, requesting, or discussing sexualized imagery, language, or suggestive content involving individuals under the legal age of 18 is prohibited without exception.',
      ],
    },
    {
      id: 'eligibility-minors',
      num: '02',
      title: 'Strict Age Restriction (No Minors Allowed)',
      icon: UserX,
      badge: 'Eligibility',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      description:
        'My Dear Partner is an adult matrimonial matchmaking platform designed exclusively for individuals seeking legal marriage partnerships.',
      points: [
        'Legal Marriageable Age: In full compliance with the law, only adults of legal marriageable age (minimum 18 years for females and 21 years for males under Indian Law, and 18+ globally) are permitted to create an account or access the platform.',
        'Prohibition of Minor Accounts: Individuals under the age of 18 are strictly prohibited from creating accounts, uploading content, or communicating on the platform.',
        'Verification Gating: We enforce mobile number OTP validation, manual profile screening, and optional Government ID verification (Aadhaar, Passport, Voter ID) to detect and prevent underage access.',
      ],
    },
    {
      id: 'detection-moderation',
      num: '03',
      title: 'Proactive Detection & Content Moderation',
      icon: Lock,
      badge: 'Enforcement',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      description:
        'We employ multi-layered proactive and reactive safety technologies to detect, prevent, and eliminate harmful material before or as soon as it appears.',
      points: [
        'Photo Pre-screening: All profile images submitted to My Dear Partner undergo automated image classification and mandatory human review by our safety operations team.',
        'Text and Chat Monitoring: Automated filtering flags prohibited keywords, predatory language, phone-sharing patterns, and illicit requests in bios, messages, and profile updates.',
        'Instant Account Neutralization: Any account suspected of involvement with CSAE or underage representation is locked immediately, revoking all active sessions and access tokens.',
      ],
    },
    {
      id: 'law-enforcement-reporting',
      num: '04',
      title: 'Mandatory Reporting to Law Enforcement & NCMEC',
      icon: Scale,
      badge: 'Legal Mandate',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      description:
        'Worexa Technologies actively cooperates with domestic and international child protection and law enforcement agencies.',
      points: [
        'Reporting to NCMEC: Any verified or suspected instance of Child Sexual Abuse Material (CSAM) or Child Sexual Abuse and Exploitation (CSAE) is reported to the National Center for Missing & Exploited Children (NCMEC) via the CyberTipline.',
        'Domestic Law Compliance: In India, we strictly comply with the Protection of Children from Sexual Offences (POCSO) Act, 2012, and Section 67B of the Information Technology Act, 2000. Incidents are escalated to the National Cyber Crime Reporting Portal (cybercrime.gov.in) and local police cyber cells.',
        'Evidence Preservation: When an infraction occurs, relevant forensic data (IP addresses, login timestamps, device fingerprints, communication logs, and uploaded files) is securely preserved to assist law enforcement investigations and prosecutions.',
      ],
    },
    {
      id: 'reporting-tools',
      num: '05',
      title: 'In-App Reporting & User Safety Tools',
      icon: Flag,
      badge: 'User Safety',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      description:
        'Members are provided with simple, instantaneous tools to report any suspicious behavior, underage profile, or harmful content.',
      points: [
        'One-Click Report Button: Every profile and chat thread features a prominent "Report Member" button allowing users to flag profiles for immediate investigation.',
        'One-Click Block: Members can instantly block any individual, cutting off all messaging and visibility immediately.',
        'Priority Triage: All reports tagged with child safety or harassment bypass standard support queues and are escalated directly to our senior Child Safety Officer with a target turnaround of under 2 hours.',
      ],
    },
    {
      id: 'contact-officer',
      num: '06',
      title: 'Designated Child Safety Team & Contact Person',
      icon: Mail,
      badge: 'Official Contact',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description:
        'In accordance with Google Play Child Safety Standards policy and statutory requirements, Worexa Technologies has appointed a dedicated Child Safety Officer and team to handle all child protection inquiries and reports.',
      points: [
        'Designated Role: Child Safety & Grievance Officer',
        'Responsible Entity: Worexa Technologies (Developer of My Dear Partner)',
        'Dedicated Child Safety Email: child-safety@mydearpartner.in',
        'Support & Alternate Inquiries: worexatechnologies@gmail.com / info.mydearpartnersupport@gmail.com',
        'Response Timeframe: Child safety reports are reviewed 24/7/365, with initial action taken within 24 hours of receipt.',
        'Physical Address: Worexa Technologies, 3rd Phase, Banashankari 3rd Stage, Banashankari, Bengaluru, Karnataka 560085, India.',
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[#fdfaf8] text-[#230914] pb-24 pt-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Link href="/" className="hover:text-[#b64a68] transition-colors">Home</Link>
          <span>/</span>
          <Link href="/terms" className="hover:text-[#b64a68] transition-colors">Legal</Link>
          <span>/</span>
          <span className="text-[#962d49] font-bold">Child Safety Standards</span>
        </nav>

        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#230914] via-[#451025] to-[#711639] p-8 sm:p-12 text-white shadow-xl mb-10">
          <div className="absolute right-0 top-0 -mt-8 -mr-8 h-64 w-64 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/30 bg-rose-500/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-rose-200 mb-4">
              <ShieldAlert className="h-3.5 w-3.5 text-rose-300" />
              Published Safety Standards
            </div>
            
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              Child Safety Standards & Policy
            </h1>
            
            <p className="mt-4 text-base sm:text-lg text-rose-100/90 leading-relaxed font-normal">
              Official safety documentation for <strong className="text-white font-bold">My Dear Partner</strong>, developed and operated by <strong className="text-white font-bold">Worexa Technologies</strong>.
            </p>

            <div className="mt-6 flex flex-wrap gap-4 text-xs text-rose-200/80 pt-4 border-t border-rose-400/20">
              <div>
                <span className="block font-bold text-white uppercase text-[10px] tracking-wider">Application</span>
                <span>My Dear Partner</span>
              </div>
              <div className="h-8 w-px bg-rose-400/20 hidden sm:block" />
              <div>
                <span className="block font-bold text-white uppercase text-[10px] tracking-wider">Developer Name</span>
                <span>Worexa Technologies</span>
              </div>
              <div className="h-8 w-px bg-rose-400/20 hidden sm:block" />
              <div>
                <span className="block font-bold text-white uppercase text-[10px] tracking-wider">Last Updated</span>
                <span>October 2026</span>
              </div>
              <div className="h-8 w-px bg-rose-400/20 hidden sm:block" />
              <div>
                <span className="block font-bold text-white uppercase text-[10px] tracking-wider">Status</span>
                <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                  <CheckCircle2 className="h-3 w-3" /> Active & Globally Enforced
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Statement Box */}
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-6 sm:p-7 mb-10 shadow-sm">
          <div className="flex gap-4 items-start">
            <div className="rounded-xl bg-red-600 p-2.5 text-white shrink-0 mt-0.5">
              <AlertOctagon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-950">
                Explicit Statement on Child Sexual Abuse and Exploitation (CSAE)
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-red-900/90">
                Worexa Technologies explicitly prohibits any form of <strong>Child Sexual Abuse and Exploitation (CSAE)</strong>, <strong>Child Sexual Abuse Material (CSAM)</strong>, grooming, solicitation, or sexualization of children on <strong>My Dear Partner</strong>. Any account found to violate this standard is subject to immediate permanent termination, device blacklisting, and mandatory reporting to law enforcement authorities (including <strong>NCMEC</strong> and national cybercrime divisions).
              </p>
            </div>
          </div>
        </div>

        {/* Standards Grid */}
        <div className="space-y-6">
          {policies.map((policy) => {
            const Icon = policy.icon;
            return (
              <div
                key={policy.id}
                id={policy.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm transition-all hover:shadow-md hover:border-slate-300"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff1f2] text-[#b64a68] border border-[#fecdd3]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-xs font-black tracking-widest text-slate-400 uppercase">
                        Section {policy.num}
                      </span>
                      <h2 className="text-xl font-bold text-[#230914]">{policy.title}</h2>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto ${policy.badgeColor}`}
                  >
                    {policy.badge}
                  </span>
                </div>

                <p className="mt-4 text-sm text-slate-700 leading-relaxed font-medium">
                  {policy.description}
                </p>

                <ul className="mt-4 space-y-2.5">
                  {policy.points.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Official Contact & Reporting Card */}
        <div className="mt-12 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-[#1f0d16] p-8 sm:p-10 text-white shadow-xl">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-[#e8bd7e]">
              Direct Safety Contact
            </span>
            <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-white">
              Report a Child Safety Concern
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              If you identify any content, profile, or user behavior that threatens minor safety or violates our Child Safety Standards, please contact our Child Safety Team immediately. All inquiries are treated with extreme urgency and strict confidentiality.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-[#e8bd7e] mb-1">
                  <Mail className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Dedicated Safety Email</span>
                </div>
                <a
                  href="mailto:child-safety@mydearpartner.in"
                  className="text-sm font-bold text-white hover:text-[#e8bd7e] transition-colors break-all underline underline-offset-2"
                >
                  child-safety@mydearpartner.in
                </a>
                <p className="text-[11px] text-slate-400 mt-1">24/7 Monitoring • Rapid Response</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-[#e8bd7e] mb-1">
                  <Mail className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">General Grievance</span>
                </div>
                <a
                  href="mailto:worexatechnologies@gmail.com"
                  className="text-sm font-bold text-white hover:text-[#e8bd7e] transition-colors break-all underline underline-offset-2"
                >
                  worexatechnologies@gmail.com
                </a>
                <p className="text-[11px] text-slate-400 mt-1">Grievance Officer: Worexa Technologies</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:col-span-2">
                <div className="flex items-center gap-2 text-[#e8bd7e] mb-1">
                  <MapPin className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Developer Office Address</span>
                </div>
                <p className="text-xs text-slate-200 font-medium">
                  Worexa Technologies, 3rd Phase, Banashankari 3rd Stage, Banashankari, Bengaluru, Karnataka 560085, India
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Compliant with Google Play Child Safety Standards Policy</span>
              </div>
              <div className="flex items-center gap-4">
                <Link href="/terms" className="hover:text-white underline underline-offset-2">
                  Terms of Service
                </Link>
                <Link href="/privacy" className="hover:text-white underline underline-offset-2">
                  Privacy Policy
                </Link>
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
