'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  Headphones,
  HelpCircle,
  LockKeyhole,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { fetchApi } from '../services/apiClient';

const contactChannels = [
  {
    icon: Phone,
    label: 'Call our team',
    value: '+91 91872 33616',
    detail: 'Available 24 hours',
    href: 'tel:+919187233616',
    tone: 'bg-[#f8e9ee] text-[#8e3d58]',
  },
  {
    icon: Mail,
    label: 'Email support',
    value: 'support@mydearpartner.com',
    detail: 'Replies usually arrive within 2-4 hours',
    href: 'mailto:support@mydearpartner.com',
    tone: 'bg-[#eaf1e7] text-[#4d7048]',
  },
  {
    icon: Building2,
    label: 'Partnerships & media',
    value: 'partnerships@mydearpartner.com',
    detail: 'For business and press enquiries',
    href: 'mailto:partnerships@mydearpartner.com',
    tone: 'bg-[#f7f0df] text-[#8b6224]',
  },
];

const quickHelp = [
  {
    icon: HelpCircle,
    eyebrow: 'Guides & support',
    title: 'Help Centre',
    description: 'Find clear guides for profiles, verification, privacy, membership, and account settings.',
    action: 'Browse Help Centre',
    href: '/help',
  },
  {
    icon: MessageCircle,
    eyebrow: 'Quick answers',
    title: 'Frequently Asked Questions',
    description: 'Get immediate answers to the questions members and families ask us most often.',
    action: 'View FAQs',
    href: '/faq',
  },
  {
    icon: ShieldCheck,
    eyebrow: 'Trust & safety',
    title: 'Report a Concern',
    description: 'Tell our safety team about a suspicious profile, privacy concern, or inappropriate activity.',
    action: 'Contact Safety Team',
    href: '#contact-form',
  },
];

type FormData = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

const emptyForm: FormData = { name: '', email: '', phone: '', subject: '', message: '' };

const fieldClassName = 'mt-2 w-full border border-[#3b1425]/12 bg-[#fcfbfa] px-3.5 py-3 text-sm text-[#20111a] outline-none transition placeholder:text-stone-400 focus:border-[#8e3d58] focus:bg-white focus:ring-4 focus:ring-[#8e3d58]/10';

export default function ContactPage() {
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError('');

    try {
      await fetchApi('/contact-enquiries/', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'We could not send your message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setSubmitError('');
    setFormData(emptyForm);
  };

  return (
    <main className="overflow-hidden bg-[#fcfbfa] text-[#20111a]">
      <section className="relative border-b border-[#3b1425]/10 bg-[#f4eee8] px-5 pb-14 pt-32 sm:px-8 sm:pb-18 lg:px-14 lg:pt-36">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_20%,rgba(185,207,174,.4),transparent_24rem),radial-gradient(circle_at_92%_12%,rgba(255,255,255,.8),transparent_28rem)]" />
        <div className="relative mx-auto grid max-w-7xl items-end gap-10 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-20">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#8e3d58]">
              <Headphones className="h-4 w-4" aria-hidden="true" />
              Contact our team
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-5xl font-light leading-[.98] tracking-[-.05em] text-[#2c2928] sm:text-6xl lg:text-7xl">
              A thoughtful answer starts with a <em className="font-serif font-normal text-[#bd6970]">conversation.</em>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">
              Whether you need account support, have a safety concern, or want to work with us, your message will reach the right team.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-stone-600">
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#4d7048]" aria-hidden="true" /> Human support</span>
              <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#8b6224]" aria-hidden="true" /> Prompt responses</span>
              <span className="inline-flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-[#8e3d58]" aria-hidden="true" /> Private by design</span>
            </div>
          </div>

          <aside className="bg-[#20111a] p-6 text-white shadow-[0_20px_45px_rgba(43,16,29,.15)] sm:p-7" aria-label="Support availability">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#e8bd7e]/15 text-[#e8bd7e]">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#e8bd7e]">Member care</p>
                <h2 className="mt-2 font-display text-2xl font-light leading-tight">Support with clarity and care.</h2>
              </div>
            </div>
            <div className="mt-7 divide-y divide-white/10 border-y border-white/10">
              <p className="flex gap-3 py-4 text-sm text-slate-300"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#6dd99b] shadow-[0_0_0_5px_rgba(109,217,155,.1)]" /> <span><strong className="block text-white">Support team online</strong>Available 24 hours</span></p>
              <p className="flex gap-3 py-4 text-sm text-slate-300"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#e8bd7e]" aria-hidden="true" /> <span><strong className="block text-white">Typical email response</strong>Within 2-4 business hours</span></p>
              <p className="flex gap-3 py-4 text-sm text-slate-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#e8bd7e]" aria-hidden="true" /> <span><strong className="block text-white">Safety concerns</strong>Reviewed through a priority queue</span></p>
            </div>
            <a href="#contact-form" className="mt-6 inline-flex w-full items-center justify-between rounded-lg bg-[#e8bd7e] px-4 py-3 text-sm font-extrabold text-[#20111a] transition hover:bg-[#f1d29d]">
              Send us a message
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </aside>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 lg:px-14 lg:py-20" id="contact-form" aria-labelledby="contact-form-title">
        <div className="mx-auto grid max-w-7xl items-start gap-10 lg:grid-cols-[.78fr_1.22fr] lg:gap-20">
          <aside>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#8e3d58]">Contact details</p>
            <h2 className="mt-3 font-display text-3xl font-light leading-tight tracking-[-.03em] text-[#2c2928] sm:text-4xl">Choose the channel that works for you.</h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-stone-600">Our care team can help with membership, verification, profiles, privacy, and general questions.</p>

            <div className="mt-8 grid gap-3">
              {contactChannels.map(({ icon: Icon, label, value, detail, href, tone }) => (
                <a key={label} href={href} className="group flex min-w-0 items-center gap-3 border border-[#3b1425]/10 bg-white p-4 shadow-[0_10px_30px_rgba(43,16,29,.04)] transition hover:-translate-y-0.5 hover:border-[#8e3d58]/25 hover:shadow-[0_14px_35px_rgba(43,16,29,.08)]">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-extrabold uppercase tracking-[.12em] text-stone-500">{label}</span>
                    <strong className="mt-1 block truncate text-sm text-[#2c2928]">{value}</strong>
                    <span className="mt-1 block text-xs text-stone-500">{detail}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#8e3d58] transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </a>
              ))}
            </div>

            <a className="mt-5 flex gap-3 border border-[#3b1425]/10 bg-[#f7f0df] p-4 transition hover:border-[#8b6224]/35" href="https://www.google.com/maps?q=Worexa+Technologies,+Banashankari,+Bengaluru" target="_blank" rel="noreferrer">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/70 text-[#8b6224]"><MapPin className="h-5 w-5" aria-hidden="true" /></span>
              <span>
                <span className="block text-[11px] font-extrabold uppercase tracking-[.12em] text-[#8b6224]">Workspace</span>
                <strong className="mt-1 block text-sm text-[#2c2928]">Gopalan Workspace, Banashankari 3rd Stage</strong>
                <span className="mt-1 block text-xs text-stone-600">Bengaluru 560085, Karnataka, India</span>
              </span>
            </a>

            <div className="mt-6 flex gap-3 border-l-2 border-[#bd6970]/40 pl-4 text-sm leading-6 text-stone-600">
              <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[#4d7048]" aria-hidden="true" />
              <p><strong className="text-[#2c2928]">Your privacy matters.</strong> We use your information only to respond to your enquiry.</p>
            </div>
          </aside>

          <div className="border border-[#3b1425]/10 bg-white shadow-[0_18px_50px_rgba(43,16,29,.07)]">
            {submitted ? (
              <div className="flex min-h-[31rem] flex-col items-center justify-center px-6 py-12 text-center sm:px-12">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eaf1e7] text-[#4d7048]"><CheckCircle2 className="h-9 w-9" aria-hidden="true" /></span>
                <p className="mt-6 text-xs font-extrabold uppercase tracking-[.18em] text-[#8e3d58]">Message received</p>
                <h2 className="mt-3 font-display text-3xl font-light text-[#2c2928] sm:text-4xl">Thank you for reaching out.</h2>
                <p className="mt-4 max-w-md text-sm leading-6 text-stone-600">Your message is now with our support team. We&apos;ll reply to <strong>{formData.email}</strong>, usually within 2-4 business hours.</p>
                <button type="button" onClick={resetForm} className="mt-7 inline-flex items-center gap-2 text-sm font-extrabold text-[#8e3d58] transition hover:text-[#702d45]">
                  Send another message
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-[#3b1425]/10 px-6 py-7 sm:px-9">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#8e3d58]">Send a message</p>
                    <h2 id="contact-form-title" className="mt-3 font-display text-3xl font-light tracking-[-.03em] text-[#2c2928]">How can we help?</h2>
                    <p className="mt-2 text-sm leading-6 text-stone-600">Share a few details and we&apos;ll connect you with the right team.</p>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#f8e9ee] text-[#8e3d58]"><Mail className="h-5 w-5" aria-hidden="true" /></span>
                </div>

                <form onSubmit={handleSubmit} className="grid gap-5 px-6 py-7 sm:px-9 sm:py-9">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block text-xs font-extrabold uppercase tracking-[.1em] text-[#68535d]" htmlFor="contact-name">
                      Full name <span className="text-[#8e3d58]">*</span>
                      <input id="contact-name" name="name" type="text" autoComplete="name" required value={formData.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Your full name" className={fieldClassName} />
                    </label>
                    <label className="block text-xs font-extrabold uppercase tracking-[.1em] text-[#68535d]" htmlFor="contact-email">
                      Email address <span className="text-[#8e3d58]">*</span>
                      <input id="contact-email" name="email" type="email" autoComplete="email" required value={formData.email} onChange={(event) => updateField('email', event.target.value)} placeholder="you@example.com" className={fieldClassName} />
                    </label>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block text-xs font-extrabold uppercase tracking-[.1em] text-[#68535d]" htmlFor="contact-phone">
                      Phone number <span className="text-[#8e3d58]">*</span>
                      <input id="contact-phone" name="phone" type="tel" autoComplete="tel" required value={formData.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="+91 98765 43210" className={fieldClassName} />
                    </label>
                    <label className="block text-xs font-extrabold uppercase tracking-[.1em] text-[#68535d]" htmlFor="contact-subject">
                      What can we help with? <span className="text-[#8e3d58]">*</span>
                      <select id="contact-subject" name="subject" required value={formData.subject} onChange={(event) => updateField('subject', event.target.value)} className={fieldClassName}>
                        <option value="" disabled>Select a topic</option>
                        <option value="general">General enquiry</option>
                        <option value="support">Account or technical support</option>
                        <option value="membership">Membership question</option>
                        <option value="verification">Profile or verification help</option>
                        <option value="safety">Trust and safety concern</option>
                        <option value="feedback">Feedback or suggestion</option>
                        <option value="partnership">Partnership or media</option>
                      </select>
                    </label>
                  </div>

                  <label className="block text-xs font-extrabold uppercase tracking-[.1em] text-[#68535d]" htmlFor="contact-message">
                    <span className="flex items-center justify-between gap-3">Your message <small className="font-semibold normal-case tracking-normal text-stone-400">{formData.message.length}/1500</small></span>
                    <textarea id="contact-message" name="message" rows={7} maxLength={1500} required value={formData.message} onChange={(event) => updateField('message', event.target.value)} placeholder="Tell us what happened and how we can help..." className={`${fieldClassName} resize-y`} />
                  </label>

                  {submitError ? <p className="border-l-2 border-[#bd6970] bg-[#f8e9ee] px-3 py-2 text-sm leading-6 text-[#702d45]" role="alert">{submitError}</p> : null}

                  <div className="flex flex-col gap-4 border-t border-[#3b1425]/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-center gap-2 text-xs font-semibold text-stone-500"><LockKeyhole className="h-4 w-4 text-[#4d7048]" aria-hidden="true" /> Your details stay private and secure.</p>
                    <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#8e3d58] px-5 py-3 text-sm font-extrabold text-white shadow-md shadow-rose-900/15 transition hover:bg-[#702d45] disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} aria-busy={submitting}>
                      {submitting ? 'Sending...' : 'Send message'}
                      {!submitting ? <Send className="h-4 w-4" aria-hidden="true" /> : null}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="border-y border-[#3b1425]/10 bg-white px-5 py-14 sm:px-8 lg:px-14 lg:py-20" aria-labelledby="quick-help-title">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#8e3d58]">Find answers faster</p>
              <h2 id="quick-help-title" className="mt-3 font-display text-3xl font-light tracking-[-.03em] text-[#2c2928] sm:text-4xl">Start with the right kind of help.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-stone-500">Explore support resources or reach the team best equipped for your question.</p>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {quickHelp.map(({ icon: Icon, eyebrow, title, description, action, href }) => (
              <article key={title} className="flex min-h-[16rem] flex-col border border-[#3b1425]/10 bg-[#fcfbfa] p-6 shadow-[0_10px_30px_rgba(43,16,29,.04)]">
                <div className="flex items-center gap-3 text-[#8e3d58]"><Icon className="h-5 w-5" aria-hidden="true" /><span className="text-[11px] font-extrabold uppercase tracking-[.14em]">{eyebrow}</span></div>
                <h3 className="mt-6 font-display text-2xl leading-tight text-[#2c2928]">{title}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-stone-600">{description}</p>
                <Link href={href} className="group mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#8e3d58] transition hover:text-[#702d45]">
                  {action}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 lg:px-14 lg:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-6 bg-[#20111a] px-6 py-8 text-white sm:px-10 sm:py-10 lg:grid-cols-[1fr_auto] lg:px-12">
          <div>
            <div className="flex items-center gap-2 text-[#e8bd7e]"><Headphones className="h-5 w-5" aria-hidden="true" /><p className="text-xs font-extrabold uppercase tracking-[.18em]">Still unsure where to begin?</p></div>
            <h2 className="mt-3 font-display text-3xl font-light leading-tight sm:text-4xl">Send a message. We&apos;ll guide it to the right team.</h2>
          </div>
          <a href="#contact-form" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#e8bd7e] px-5 py-3 text-sm font-extrabold text-[#20111a] transition hover:bg-[#f1d29d]">Contact us <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
        </div>
      </section>
    </main>
  );
}
