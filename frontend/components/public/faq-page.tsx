'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronDown,
  Search,
  HelpCircle,
  ShieldCheck,
  Users,
  Heart,
  Phone,
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

const faqCategories = [
  { id: 'all', name: 'All Questions' },
  { id: 'family', name: 'Family & Trust' },
  { id: 'safety', name: 'Safety & Privacy' },
  { id: 'membership', name: 'Membership & Plans' },
  { id: 'features', name: 'Features & Matchmaking' },
  { id: 'support', name: 'App & Support' },
];

const faqs = [
  {
    id: 1,
    category: 'family',
    question: 'My family is traditional. Will we feel comfortable here?',
    answer: "We were built for families like yours. MyDearPartner isn't a dating app; it's a family-first platform where parents and elders are not just welcome but essential. Everything we do respects the way Indian families approach matchmaking, with privacy, trust, and shared decision-making.",
  },
  {
    id: 2,
    category: 'family',
    question: 'Can my parents create a profile for me?',
    answer: 'Absolutely. Many of our members are parents registering on behalf of their children. You can involve as many family members as you like at any stage. We welcome families to create and manage profiles together.',
  },
  {
    id: 3,
    category: 'membership',
    question: 'Do I have to pay to register?',
    answer: "No. Registration is completely free. You can create your profile, browse matches, and receive daily recommendations at no cost. Upgrade to premium only when you're ready to move faster.",
  },
  {
    id: 4,
    category: 'features',
    question: "What if I'm not sure what I'm looking for?",
    answer: "That's perfectly okay. Many members start with a vague idea and discover what truly matters as they explore. Our relationship advisors can help you clarify your preferences over time. Your profile can evolve as your understanding deepens.",
  },
  {
    id: 5,
    category: 'safety',
    question: 'Is my personal information safe?',
    answer: "Absolutely. All data is protected with 256-bit SSL encryption, the same level used by banks. We never share your information with third parties without your explicit consent. Your family's privacy is our most sacred responsibility.",
  },
  {
    id: 6,
    category: 'safety',
    question: 'Who can see my profile?',
    answer: 'You control this completely. Our privacy settings let you decide who can view your photos, contact details, and family information. You can also block specific members or hide your profile from certain communities. You are always in control.',
  },
  {
    id: 7,
    category: 'safety',
    question: 'How do I know profiles are real?',
    answer: 'Every profile undergoes manual human review before it goes live. We check photos, verify information, and ensure genuine intent. Premium members can also opt for government ID verification. When you see a "Verified" badge, you can trust that the family is real.',
  },
  {
    id: 8,
    category: 'features',
    question: 'How do I find matches?',
    answer: 'We do the work for you! Based on your preferences and family values, we curate a daily list of compatible profiles and send them directly to you. You can also use our advanced search filters to explore matches on your own.',
  },
  {
    id: 9,
    category: 'family',
    question: 'Can I search outside my community?',
    answer: "Absolutely. If you're open to matches from different communities, you can broaden your search. MyDearPartner is an inclusive platform that respects both traditional and modern preferences.",
  },
  {
    id: 10,
    category: 'features',
    question: 'What is Kundli Matching?',
    answer: 'For families who value astrological compatibility, we provide detailed kundli matching. Our system calculates compatibility based on traditional criteria (Guna Milan, Manglik status, etc.) and presents you with a compatibility score.',
  },
  {
    id: 11,
    category: 'membership',
    question: 'What do I get with a free membership?',
    answer: 'With a free membership, you can:',
    list: [
      'Create and manage your profile',
      'Receive daily curated matches',
      'Browse limited profiles',
      'Shortlist your favorite matches',
      'Express interest in matches',
    ],
    footer: 'You can explore our platform fully without any payment.',
  },
  {
    id: 12,
    category: 'membership',
    question: 'What are the benefits of a premium?',
    answer: "Premium unlocks unlimited profile views, contact information access, priority visibility, a dedicated relationship advisor, HD video calls, advanced partner preferences, 5x profile reach, and a premium verification badge. It's everything you need to move faster.",
  },
  {
    id: 13,
    category: 'membership',
    question: 'Can I upgrade to premium later?',
    answer: "Absolutely. Start with a free membership, explore, and upgrade whenever you feel ready. There's no pressure and no deadlines. Many members do this; they test the platform first and then commit when they see the value.",
  },
  {
    id: 14,
    category: 'family',
    question: 'Can my parents join conversations?',
    answer: 'Yes. Our "Family Connect" feature allows parents and elders to join conversations, review matches, and participate in video calls. We believe marriage decisions are made together as a family.',
  },
  {
    id: 15,
    category: 'features',
    question: 'Can I video call a match before meeting?',
    answer: 'Yes. Premium members have access to secure HD video calls. This is especially helpful for long-distance connections or for families who want to meet virtually before an in-person meeting.',
  },
  {
    id: 16,
    category: 'family',
    question: 'How many marriages have happened through MyDearPartner?',
    answer: "We're proud to have facilitated 50,000+ successful marriages and counting. Every day, more families find their perfect match. These aren't just numbers, they're real families, real love stories, and real happily-ever-afters.",
  },
  {
    id: 17,
    category: 'features',
    question: 'How long does it typically take to find a match?',
    answer: 'Every journey is unique. Some members find their match within weeks, others take a few months. Our average match-finding time is 3-6 months. We encourage patience; finding the right partner is about quality, not speed.',
  },
  {
    id: 18,
    category: 'support',
    question: 'Is MyDearPartner available as a mobile app?',
    answer: 'Yes! Download our app from the Google Play Store or Apple App Store. The app gives you full access to profiles, matches, messaging, and video calls on the go. Available for both Android and iOS.',
  },
  {
    id: 19,
    category: 'support',
    question: 'How do I contact support?',
    answer: 'You can reach us in multiple ways:',
    contacts: [
      { icon: Phone, label: 'Phone', detail: '+91 1800-123-4567 (9 AM - 9 PM, Mon-Sat)' },
      { icon: Mail, label: 'Email', detail: 'support@mydearpartner.com' },
      { icon: MessageSquare, label: 'Live Chat', detail: 'Available on our website and app' },
    ],
    footer: 'We typically respond within 24 hours.',
  },
  {
    id: 20,
    category: 'support',
    question: 'What languages does the platform support?',
    answer: 'We support multiple languages, including English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, and more. You can switch languages from the settings menu. We want every family to feel comfortable.',
  },
];

export default function FaqContentPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [openItems, setOpenItems] = useState<Record<number, boolean>>({ 1: true, 2: true });

  const toggleItem = (id: number) => {
    setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <main className="overflow-hidden bg-[#fffefd] pt-20 text-[#2c2928]">
      {/* Hero Section */}
      <section className="relative isolate overflow-hidden bg-[#f4eee8] px-5 py-20 sm:px-8 lg:py-28">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_10%_20%,rgba(185,207,174,.48),transparent_28rem),radial-gradient(circle_at_88%_8%,rgba(255,255,255,.82),transparent_26rem)]" />
        <div className="absolute left-1/2 top-4 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-rose-200/30 blur-3xl" />

        <div className="mx-auto max-w-4xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#8e3d58]/15 bg-white/80 px-4 py-2 text-xs font-extrabold uppercase tracking-[.14em] text-[#8e3d58] shadow-sm">
            <Image src="/images/main-logo.png" alt="" width={16} height={16} className="h-4 w-4 object-contain" /> Frequently Asked Questions
          </p>
          <h1 className="mt-6 font-display text-4xl font-light leading-[1.05] tracking-[-.05em] text-[#2c2928] sm:text-5xl lg:text-6xl">
            Frequently Asked <em className="font-serif font-normal text-[#bd6970]">Questions.</em>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg sm:text-xl font-medium text-[#8e3d58]">
            Honest answers to the questions families ask us most.
          </p>

          {/* Search Filter input */}
          <div className="relative mx-auto mt-8 max-w-xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search your question (e.g., privacy, parents, free)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-[#3b1425]/15 bg-white py-4 pl-12 pr-5 text-sm font-medium text-slate-800 placeholder-slate-400 shadow-md focus:border-[#8e3d58] focus:outline-none focus:ring-2 focus:ring-[#8e3d58]/20"
            />
          </div>
        </div>
      </section>

      {/* Categories Filter Tabs */}
      <section className="border-b border-slate-200/80 bg-white px-5 py-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-2">
          {faqCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-full px-5 py-2.5 text-xs font-bold transition ${
                selectedCategory === cat.id
                  ? 'bg-[#8e3d58] text-white shadow-sm'
                  : 'bg-[#fffaf7] text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </section>

      {/* Accordion FAQ Content List */}
      <section className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-4xl space-y-4">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq) => {
              const isOpen = !!openItems[faq.id];
              return (
                <div
                  key={faq.id}
                  className="overflow-hidden rounded-2xl border border-[#3b1425]/10 bg-white shadow-sm transition duration-200 hover:border-[#8e3d58]/30"
                >
                  <button
                    onClick={() => toggleItem(faq.id)}
                    className="flex w-full items-center justify-between gap-4 p-6 text-left"
                  >
                    <span className="text-base sm:text-lg font-bold text-[#20111a]">
                      {faq.id}. {faq.question}
                    </span>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-50 text-[#8e3d58] transition-transform duration-300 ${isOpen ? 'rotate-180 bg-[#8e3d58] text-white' : ''}`}>
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 bg-[#fffaf7] p-6 text-base leading-8 text-slate-700">
                      <p>{faq.answer}</p>

                      {faq.list && (
                        <ul className="mt-3 space-y-2 pl-2">
                          {faq.list.map((item, idx) => (
                            <li key={idx} className="flex items-center gap-2 font-medium text-slate-800 text-sm sm:text-base">
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#b64a68]" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {faq.contacts && (
                        <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 border border-rose-100">
                          {faq.contacts.map((c, i) => {
                            const IconComponent = c.icon;
                            return (
                              <div key={i} className="flex items-center gap-3 text-sm font-bold text-slate-800">
                                <span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-[#8e3d58]">
                                  <IconComponent className="h-4 w-4" />
                                </span>
                                <span>
                                  <strong>{c.label}:</strong> {c.detail}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {faq.footer && (
                        <p className="mt-3 font-semibold text-[#8e3d58]">{faq.footer}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center">
              <HelpCircle className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-3 font-bold text-slate-700">No matching questions found.</p>
              <p className="mt-1 text-sm text-slate-500">Try adjusting your search query or category filter.</p>
            </div>
          )}
        </div>
      </section>

      {/* Still Have Questions / Contact CTA */}
      <section className="bg-[#20111a] px-5 py-20 text-white sm:px-8 lg:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-rose-300">Here to Help</p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-.04em] sm:text-4xl">
            Still Have Questions?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-slate-300">
            Our family support team is available 6 days a week to assist you with any questions or guidance.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#8e3d58] px-7 text-sm font-extrabold text-white shadow-lg transition hover:bg-[#a64a69]"
            >
              Contact Family Support <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white/10 px-7 text-sm font-extrabold text-white transition hover:bg-white/20"
            >
              Create Free Profile
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
