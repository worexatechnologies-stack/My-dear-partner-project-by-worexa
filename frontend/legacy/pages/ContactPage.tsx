'use client';

import { useState } from 'react';
import { Link } from '@/lib/router-compat';
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
    detail: 'Toll-free · Monday to Saturday',
    href: 'tel:+919187233616',
  },
  {
    icon: Mail,
    label: 'Email support',
    value: 'support@mydearpartner.com',
    detail: 'Replies usually arrive within 2–4 hours',
    href: 'mailto:support@mydearpartner.com',
  },
  {
    icon: Building2,
    label: 'Partnerships & media',
    value: 'partnerships@mydearpartner.com',
    detail: 'For business and press enquiries',
    href: 'mailto:partnerships@mydearpartner.com',
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

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const updateField = (field: keyof typeof formData, value: string) => {
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
    setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
  };


  return (
    <main className="ct-page">
      <section className="ct-hero">
        <div className="ct-hero__glow ct-hero__glow--one" aria-hidden="true" />
        <div className="ct-hero__glow ct-hero__glow--two" aria-hidden="true" />

        <div className="ct-shell ct-hero__grid">
          <div className="ct-hero__copy">
            <span className="ct-kicker">
              <Headphones size={15} /> Here when you need us
            </span>
            <h1>
              Let&apos;s start a
              <span>helpful conversation.</span>
            </h1>
            <p>
              Whether you need account support, have a safety concern, or want to work with us,
              our team will make sure your message reaches the right person.
            </p>

            <div className="ct-hero__assurances" aria-label="Support assurances">
              <span><CheckCircle2 size={16} /> Human support</span>
              <span><Clock3 size={16} /> Prompt responses</span>
              <span><LockKeyhole size={16} /> Private by design</span>
            </div>
          </div>

          <aside className="ct-hero-card" aria-label="Support availability">
            <div className="ct-hero-card__top">
              <div className="ct-hero-card__icon"><ShieldCheck size={22} /></div>
              <div>
                <span>Member care</span>
                <h2>Support with clarity and care.</h2>
              </div>
            </div>

            <div className="ct-hero-card__list">
              <div>
                <span className="ct-status-dot" />
                <p><strong>Support team online</strong><small>Monday–Saturday · 9:00 AM–8:00 PM IST</small></p>
              </div>
              <div>
                <Mail size={18} />
                <p><strong>Typical email response</strong><small>Within 2–4 business hours</small></p>
              </div>
              <div>
                <ShieldCheck size={18} />
                <p><strong>Safety concerns</strong><small>Reviewed through a priority queue</small></p>
              </div>
            </div>

            <a href="#contact-form" className="ct-hero-card__action">
              Send us a message <ArrowRight size={16} />
            </a>
          </aside>
        </div>
      </section>

      <section className="ct-contact-section" aria-labelledby="contact-form-title">
        <div className="ct-shell ct-contact-grid">
          <aside className="ct-contact-details">
            <span className="ct-section-label">Contact details</span>
            <h2>Choose the channel that works for you.</h2>
            <p className="ct-contact-details__intro">
              Our care team can help with membership, verification, profiles, privacy, and general questions.
            </p>

            <div className="ct-channel-list">
              {contactChannels.map(({ icon: Icon, label, value, detail, href }) => (
                <a className="ct-channel" href={href} key={label}>
                  <span className="ct-channel__icon"><Icon size={20} /></span>
                  <span className="ct-channel__content">
                    <small>{label}</small>
                    <strong>{value}</strong>
                    <span>{detail}</span>
                  </span>
                  <ArrowRight className="ct-channel__arrow" size={17} />
                </a>
              ))}
            </div>

            <a className="ct-office-card" href="https://www.google.com/maps?q=Worexa+Technologies,+Banashankari,+Bengaluru" target="_blank" rel="noreferrer">
              <span className="ct-office-card__icon"><MapPin size={20} /></span>
              <div>
                <small>Workspace</small>
                <strong>Gopalan Workspace, Banashankari 3rd Stage</strong>
                <p>Bengaluru 560085, Karnataka, India</p>
              </div>
            </a>

            <div className="ct-privacy-note">
              <ShieldCheck size={19} />
              <p><strong>Your privacy matters.</strong> We use your information only to respond to your enquiry.</p>
            </div>
          </aside>

          <div className="ct-form-card" id="contact-form">
            {submitted ? (
              <div className="ct-success" role="status" aria-live="polite">
                <span className="ct-success__icon"><CheckCircle2 size={38} /></span>
                <span className="ct-section-label">Message received</span>
                <h2>Thank you for reaching out.</h2>
                <p>
                  Your message is now with our support team. We&apos;ll reply to
                  <strong> {formData.email}</strong>, usually within 2–4 business hours.
                </p>
                <button type="button" onClick={resetForm} className="ct-text-button">
                  Send another message <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <>
                <div className="ct-form-card__header">
                  <div>
                    <span className="ct-section-label">Send a message</span>
                    <h2 id="contact-form-title">How can we help?</h2>
                    <p>Share a few details and we&apos;ll connect you with the right team.</p>
                  </div>
                  <span className="ct-form-card__mail"><Mail size={22} /></span>
                </div>

                <form onSubmit={handleSubmit} className="ct-form">
                  <div className="ct-form__row">
                    <div className="ct-field">
                      <label htmlFor="contact-name">Full name <span>*</span></label>
                      <input
                        id="contact-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        value={formData.name}
                        onChange={(event) => updateField('name', event.target.value)}
                        placeholder="Your full name"
                      />
                    </div>

                    <div className="ct-field">
                      <label htmlFor="contact-email">Email address <span>*</span></label>
                      <input
                        id="contact-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={formData.email}
                        onChange={(event) => updateField('email', event.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div className="ct-form__row">
                    <div className="ct-field">
                      <label htmlFor="contact-phone">Phone number <span>*</span></label>
                      <input
                        id="contact-phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        required
                        value={formData.phone}
                        onChange={(event) => updateField('phone', event.target.value)}
                        placeholder="+91 98765 43210"
                      />
                    </div>

                    <div className="ct-field">
                      <label htmlFor="contact-subject">What can we help with? <span>*</span></label>
                      <select
                        id="contact-subject"
                        name="subject"
                        required
                        value={formData.subject}
                        onChange={(event) => updateField('subject', event.target.value)}
                      >
                        <option value="" disabled>Select a topic</option>
                        <option value="general">General enquiry</option>
                        <option value="support">Account or technical support</option>
                        <option value="membership">Membership question</option>
                        <option value="verification">Profile or verification help</option>
                        <option value="safety">Trust and safety concern</option>
                        <option value="feedback">Feedback or suggestion</option>
                        <option value="partnership">Partnership or media</option>
                      </select>
                    </div>
                  </div>


                  <div className="ct-field">
                    <div className="ct-field__label-row">
                      <label htmlFor="contact-message">Your message <span>*</span></label>
                      <small>{formData.message.length}/1500</small>
                    </div>
                    <textarea
                      id="contact-message"
                      name="message"
                      rows={7}
                      maxLength={1500}
                      required
                      value={formData.message}
                      onChange={(event) => updateField('message', event.target.value)}
                      placeholder="Tell us what happened and how we can help..."
                    />
                  </div>

                  {submitError && (
                    <p className="ct-form__error" role="alert">{submitError}</p>
                  )}

                  <div className="ct-form__footer">
                    <p><LockKeyhole size={15} /> Your details stay private and secure.</p>
                    <button type="submit" className="ct-submit" disabled={submitting} aria-busy={submitting}>
                      {submitting ? 'Sending...' : 'Send message'}
                      {!submitting && <Send size={17} />}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="ct-help-section" aria-labelledby="quick-help-title">
        <div className="ct-shell">
          <div className="ct-section-heading">
            <div>
              <span className="ct-section-label">Find answers faster</span>
              <h2 id="quick-help-title">Start with the right kind of help.</h2>
            </div>
            <p>Explore our support resources or reach the team best equipped for your question.</p>
          </div>

          <div className="ct-help-grid">
            {quickHelp.map(({ icon: Icon, eyebrow, title, description, action, href }, index) => (
              <article className={`ct-help-card ct-help-card--${index + 1}`} key={title}>
                <div className="ct-help-card__top">
                  <span className="ct-help-card__icon"><Icon size={23} /></span>
                  <small>{eyebrow}</small>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                <Link to={href} className="ct-help-card__link">
                  {action} <ArrowRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ct-closing">
        <div className="ct-shell">
          <div className="ct-closing__inner">
            <div className="ct-closing__icon"><Headphones size={25} /></div>
            <div>
              <span>Still unsure where to begin?</span>
              <h2>Send a message. We&apos;ll guide it to the right team.</h2>
            </div>
            <a href="#contact-form" className="ct-closing__action">
              Contact us <ArrowRight size={17} />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
