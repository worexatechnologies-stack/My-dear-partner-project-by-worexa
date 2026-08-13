import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Headphones,
  LockKeyhole,
  Mail,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Help Centre | MyDearPartner',
  description: 'Find answers about your MyDearPartner account, privacy, membership, and support.',
  alternates: { canonical: '/help' },
};

const helpTopics = [
  {
    icon: BadgeCheck,
    eyebrow: 'Account & verification',
    title: 'Keep your profile trusted',
    description: 'Get help with profile details, verification, photos, and account access.',
    href: '/faq',
    linkLabel: 'Account questions',
    tone: 'bg-[#f8e9ee] text-[#8e3d58]',
  },
  {
    icon: CreditCard,
    eyebrow: 'Membership & plans',
    title: 'Understand your membership',
    description: 'Compare plans, learn about activation, and find answers about membership changes.',
    href: '/membership',
    linkLabel: 'View membership',
    tone: 'bg-[#f7f0df] text-[#8b6224]',
  },
  {
    icon: LockKeyhole,
    eyebrow: 'Safety & privacy',
    title: 'Stay in control',
    description: 'Review privacy choices and learn how to use MyDearPartner with confidence.',
    href: '/privacy',
    linkLabel: 'Privacy information',
    tone: 'bg-[#eaf1e7] text-[#4d7048]',
  },
  {
    icon: MessageSquare,
    eyebrow: 'Personal support',
    title: 'Talk to our team',
    description: 'Ask a question, report a concern, or follow up on an issue with a real person.',
    href: '/contact',
    linkLabel: 'Contact support',
    tone: 'bg-[#eeeaf4] text-[#66527d]',
  },
];

const quickAnswers = [
  {
    question: 'Is registration free?',
    answer: 'Yes. You can create a profile and explore the platform without paying. Membership plans are available when you are ready for additional access.',
  },
  {
    question: 'How do I know a profile is genuine?',
    answer: 'Profiles are reviewed, and eligible members can complete identity verification. Look for verification information on profiles and use the report or block tools if something feels wrong.',
  },
  {
    question: 'Can I change my membership later?',
    answer: 'Yes. You can review the available plans and request a membership change from the membership page. Our team can help if you have a question about an active plan.',
  },
  {
    question: 'How do I get help with my account?',
    answer: 'Signed-in members can open and follow a private support ticket. For a general enquiry, use the contact form and our team will respond there.',
  },
];

export default function HelpPage() {
  return (
    <main className="overflow-hidden bg-[#fcfbfa] text-[#20111a]">
      <section className="relative border-b border-[#3b1425]/10 bg-[#f4eee8] px-5 pb-16 pt-32 sm:px-8 sm:pb-20 lg:px-14 lg:pt-36">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_20%,rgba(185,207,174,.4),transparent_24rem),radial-gradient(circle_at_92%_12%,rgba(255,255,255,.8),transparent_28rem)]" />
        <div className="relative mx-auto grid max-w-7xl items-end gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-20">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#8e3d58]">
              <CircleHelp className="h-4 w-4" aria-hidden="true" />
              Help centre
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-5xl font-light leading-[.98] tracking-[-.05em] text-[#2c2928] sm:text-6xl lg:text-7xl">
              Find the right <em className="font-serif font-normal text-[#bd6970]">next step.</em>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">
              Clear answers for your account, your privacy, and your matchmaking journey. Start with a topic or reach our support team directly.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/faq"
                className="inline-flex items-center gap-2 rounded-xl bg-[#8e3d58] px-4 py-3 text-sm font-bold text-white shadow-md shadow-rose-900/15 transition hover:bg-[#702d45]"
              >
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                Browse all FAQs
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-xl border border-[#8e3d58]/20 bg-white/70 px-4 py-3 text-sm font-bold text-[#633447] transition hover:border-[#8e3d58]/40 hover:bg-white"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Contact support
              </Link>
            </div>
          </div>

          <aside className="border-l-2 border-[#bd6970]/40 pl-5 lg:mb-1" aria-label="Support overview">
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#8e3d58]">Support overview</p>
            <p className="mt-3 font-display text-2xl leading-tight text-[#2c2928]">The answer should feel as considered as the connection.</p>
            <div className="mt-5 grid gap-3 text-sm text-stone-600">
              <p className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#4d7048]" aria-hidden="true" />
                Privacy and safety guidance
              </p>
              <p className="flex items-start gap-2.5">
                <Headphones className="mt-0.5 h-4 w-4 shrink-0 text-[#8e3d58]" aria-hidden="true" />
                Human help when an answer is not enough
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-14 lg:py-20" aria-labelledby="help-topics-title">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#8e3d58]">Start here</p>
              <h2 id="help-topics-title" className="mt-3 font-display text-3xl font-light tracking-[-.03em] text-[#2c2928] sm:text-4xl">
                What do you need help with?
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-stone-500">Choose the area closest to your question and we will take you to the most useful place.</p>
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {helpTopics.map((topic) => {
              const Icon = topic.icon;
              return (
                <article key={topic.title} className="flex min-h-[17rem] flex-col border border-[#3b1425]/10 bg-white p-6 shadow-[0_12px_35px_rgba(43,16,29,.05)] transition hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(43,16,29,.1)]">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${topic.tone}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#8e3d58]">{topic.eyebrow}</p>
                  <h3 className="mt-2 font-display text-2xl leading-tight text-[#2c2928]">{topic.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-stone-600">{topic.description}</p>
                  <Link href={topic.href} className="group mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#8e3d58] transition hover:text-[#702d45]">
                    {topic.linkLabel}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-[#3b1425]/10 bg-white px-5 py-16 sm:px-8 lg:px-14 lg:py-20" aria-labelledby="quick-answers-title">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#8e3d58]">Quick answers</p>
            <h2 id="quick-answers-title" className="mt-3 max-w-md font-display text-3xl font-light leading-tight tracking-[-.03em] text-[#2c2928] sm:text-4xl">
              A few useful answers, without the extra searching.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-stone-600">For the full library, browse every question by category on our FAQ page.</p>
            <Link href="/faq" className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#8e3d58] hover:text-[#702d45]">
              See all frequently asked questions
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="divide-y divide-[#3b1425]/10 border-y border-[#3b1425]/10">
            {quickAnswers.map((item, index) => (
              <details key={item.question} open={index === 0} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-left font-display text-xl text-[#2c2928] [&::-webkit-details-marker]:hidden">
                  <span>{item.question}</span>
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#8e3d58] transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="max-w-2xl pr-8 pt-3 text-sm leading-6 text-stone-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-14 lg:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-8 bg-[#20111a] px-6 py-8 text-white sm:px-10 sm:py-10 lg:grid-cols-[1fr_auto] lg:px-12">
          <div>
            <div className="flex items-center gap-2 text-[#e8bd7e]">
              <Headphones className="h-5 w-5" aria-hidden="true" />
              <p className="text-xs font-extrabold uppercase tracking-[.18em]">Still need a hand?</p>
            </div>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-light leading-tight sm:text-4xl">Bring us the question. We will help you find the answer.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Signed-in members can create and follow a private support ticket. For a general enquiry, contact the team directly.</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link href="/tickets" className="inline-flex items-center gap-2 rounded-xl bg-[#e8bd7e] px-4 py-3 text-sm font-extrabold text-[#20111a] transition hover:bg-[#f1d29d]">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Open a ticket
            </Link>
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-extrabold text-white transition hover:border-white/50 hover:bg-white/10">
              <Mail className="h-4 w-4" aria-hidden="true" />
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
