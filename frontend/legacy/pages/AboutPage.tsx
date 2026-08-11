'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Heart,
  ShieldCheck,
  Users,
  Globe,
  Target,
  CheckCircle,
  ArrowRight,
  HeartHandshake,
  UserCheck,
  Lock,
  MapPin,
  Award,
  Compass,
  Quote
} from 'lucide-react';
import { Link } from '@/lib/router-compat';
import SmartImage from '@/components/shared/smart-image';

/* ── STATS DATA ────────────────────────────────────────────── */
const stats = [
  { value: '25L+', label: 'Verified Profiles', icon: Users },
  { value: '9+', label: 'Years of Trust', icon: ShieldCheck },
  { value: '5L+', label: 'Happy Couples', icon: Heart },
  { value: '500+', label: 'Cities Covered', icon: MapPin },
];

/* ── DIFFERENTIATORS ────────────────────────────────────────── */
const differentiators = [
  {
    icon: UserCheck,
    title: 'Authenticity Above Everything',
    desc: 'Every profile represents a real, verified individual looking for a genuine, lifelong connection.',
    tag: 'Authentic',
  },
  {
    icon: ShieldCheck,
    title: 'Trust & Safety at Every Step',
    desc: 'From government ID verification to robust privacy controls, your security is built into every feature.',
    tag: 'Secure',
  },
  {
    icon: Heart,
    title: 'Relationships Before Algorithms',
    desc: 'Smart recommendations assist your search, but human values, intentions, and mutual choices define every match.',
    tag: 'People First',
  },
  {
    icon: Users,
    title: 'Designed for Individuals & Families',
    desc: 'Marriage brings two lives and two families together. We respect personal choices alongside family involvement.',
    tag: 'Family First',
  },
];

/* ── VALUES LIST ────────────────────────────────────────────── */
const valuesList = [
  {
    title: 'Trust',
    desc: 'Every meaningful relationship begins with honesty, safety, and mutual transparency.',
  },
  {
    title: 'Respect',
    titleFull: 'Respect & Dignity',
    desc: 'Every person, culture, tradition, and life story deserves complete respect.',
  },
  {
    title: 'Privacy',
    desc: 'Your personal details belong to you. Protecting them is our highest responsibility.',
  },
  {
    title: 'Commitment',
    desc: 'We are dedicated to helping people build relationships that stand the test of time.',
  },
];

/* ── ANIMATION VARIANTS ─────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

export default function AboutPage() {
  return (
    <main className="ab-page">

      {/* ── HERO — INTERLOCKING RINGS & CHAIN ART ────────────── */}
      <section className="ab-hero">
        {/* Hidden — no bg image used */}
        <div className="ab-hero__bg" />

        {/* Ambient Glows */}
        <div className="ab-hero__ambient" aria-hidden />
        <div className="ab-hero__ambient-secondary" aria-hidden />

        {/* Left Column: Content */}
        <div className="ab-hero__container">
          <div className="ab-hero__grid">
            <motion.div
              className="ab-hero__left"
            >
              <span className="ab-hero__badge">
                <Heart size={12} fill="currentColor" /> ESTABLISHED ON TRUST &amp; COMPATIBILITY
              </span>

              <h1>
                Where Genuine Intentions
                <em>Become Lifelong Marriages.</em>
              </h1>

              <p className="ab-hero__lead">
                MyDearPartner was created to bring authenticity back to matchmaking. We combine 100% verified profiles, family respect, and strict privacy controls to help you build a lasting, meaningful relationship.
              </p>

              {/* Glassmorphic Metrics Bar */}
              <div className="ab-hero__metrics-bar">
                <div className="ab-hero__metric-item">
                  <span className="ab-hero__metric-val">50,000+</span>
                  <span className="ab-hero__metric-lbl">Happy Marriages</span>
                </div>
                <div className="ab-hero__metric-sep" />
                <div className="ab-hero__metric-item">
                  <span className="ab-hero__metric-val">100%</span>
                  <span className="ab-hero__metric-lbl">Verified Profiles</span>
                </div>
                <div className="ab-hero__metric-sep" />
                <div className="ab-hero__metric-item">
                  <span className="ab-hero__metric-val">4.9★</span>
                  <span className="ab-hero__metric-lbl">Satisfaction</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="ab-hero__ctas">
                <Link to="/register" className="ab-btn-primary">
                  <Users size={16} /> Create Free Profile <ArrowRight size={16} />
                </Link>
                <a href="#our-story" className="ab-btn-secondary">
                  <HeartHandshake size={16} className="text-gold" /> Explore Our Story
                </a>
              </div>

              {/* Micro Trust Pills */}
              <div className="ab-hero__trust-pills">
                <div className="ab-trust-pill">
                  <ShieldCheck size={14} className="text-gold" /> Govt ID Verified
                </div>
                <div className="ab-trust-pill">
                  <Lock size={14} className="text-gold" /> 100% Confidential
                </div>
                <div className="ab-trust-pill">
                  <Users size={14} className="text-gold" /> Individual &amp; Family Centric
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right Column: decorative ring art only. All page copy stays on the left. */}
        <motion.div
          className="ab-hero__right"
          aria-hidden="true"
        >
          <div className="ab-hero__rings">
            <div className="ab-hero__ring-aura" />
            <div className="ab-hero__ring-orbit ab-hero__ring-orbit--outer" />
            <div className="ab-hero__ring-orbit ab-hero__ring-orbit--inner" />

            <svg
              className="ab-hero__ring-illustration"
              viewBox="0 0 560 520"
              focusable="false"
            >
              <defs>
                <linearGradient id="ab-gold-band" x1="145" y1="135" x2="440" y2="410" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#76501f" />
                  <stop offset="0.16" stopColor="#d1a34e" />
                  <stop offset="0.32" stopColor="#fff1b8" />
                  <stop offset="0.48" stopColor="#bd812b" />
                  <stop offset="0.66" stopColor="#f5d986" />
                  <stop offset="0.82" stopColor="#b97827" />
                  <stop offset="1" stopColor="#684119" />
                </linearGradient>
                <linearGradient id="ab-platinum-band" x1="115" y1="150" x2="365" y2="420" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#5f5a5c" />
                  <stop offset="0.16" stopColor="#b9b7b7" />
                  <stop offset="0.34" stopColor="#fffdf8" />
                  <stop offset="0.5" stopColor="#9b989a" />
                  <stop offset="0.68" stopColor="#eeeae5" />
                  <stop offset="0.84" stopColor="#8a8486" />
                  <stop offset="1" stopColor="#514a4d" />
                </linearGradient>
                <linearGradient id="ab-diamond" x1="-28" y1="-30" x2="24" y2="31" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset="0.22" stopColor="#e8fbff" />
                  <stop offset="0.46" stopColor="#ffffff" />
                  <stop offset="0.7" stopColor="#cce7ed" />
                  <stop offset="1" stopColor="#fff9dd" />
                </linearGradient>
                <radialGradient id="ab-gem-flash" cx="38%" cy="28%" r="70%">
                  <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="0.42" stopColor="#e5f8fb" stopOpacity="0.8" />
                  <stop offset="1" stopColor="#bddde4" stopOpacity="0.18" />
                </radialGradient>
                <filter id="ab-ring-shadow" x="-45%" y="-45%" width="190%" height="200%">
                  <feDropShadow dx="0" dy="16" stdDeviation="12" floodColor="#5e3b31" floodOpacity="0.22" />
                </filter>
                <filter id="ab-diamond-glow" x="-120%" y="-120%" width="340%" height="340%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="ab-floor-blur" x="-30%" y="-100%" width="160%" height="300%">
                  <feGaussianBlur stdDeviation="10" />
                </filter>
              </defs>

              {/* A soft contact shadow grounds the jewelry. */}
              <ellipse cx="283" cy="407" rx="174" ry="22" fill="#76452c" opacity="0.16" filter="url(#ab-floor-blur)" />

              <g filter="url(#ab-ring-shadow)">
                {/* Polished platinum wedding band, set behind. */}
                <ellipse
                  cx="218"
                  cy="307"
                  rx="137"
                  ry="104"
                  transform="rotate(-18 218 307)"
                  fill="none"
                  stroke="#494044"
                  strokeWidth="34"
                  opacity="0.23"
                />
                <ellipse
                  cx="218"
                  cy="297"
                  rx="137"
                  ry="104"
                  transform="rotate(-18 218 297)"
                  fill="none"
                  stroke="url(#ab-platinum-band)"
                  strokeWidth="27"
                />
                <ellipse
                  cx="218"
                  cy="297"
                  rx="137"
                  ry="104"
                  transform="rotate(-18 218 297)"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray="30 70"
                  strokeDashoffset="54"
                  opacity="0.8"
                />

                {/* Champagne-gold solitaire ring in front. */}
                <ellipse
                  cx="342"
                  cy="294"
                  rx="134"
                  ry="106"
                  transform="rotate(16 342 294)"
                  fill="none"
                  stroke="#604019"
                  strokeWidth="35"
                  opacity="0.24"
                />
                <ellipse
                  cx="342"
                  cy="283"
                  rx="134"
                  ry="106"
                  transform="rotate(16 342 283)"
                  fill="none"
                  stroke="url(#ab-gold-band)"
                  strokeWidth="28"
                />
                <ellipse
                  cx="342"
                  cy="283"
                  rx="134"
                  ry="106"
                  transform="rotate(16 342 283)"
                  fill="none"
                  stroke="#fff7d5"
                  strokeWidth="4"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray="29 71"
                  strokeDashoffset="53"
                  opacity="0.9"
                />

                {/* Platinum returns to the foreground at one crossing for a true interlock. */}
                <ellipse
                  cx="218"
                  cy="307"
                  rx="137"
                  ry="104"
                  transform="rotate(-18 218 307)"
                  fill="none"
                  stroke="#494044"
                  strokeWidth="34"
                  pathLength="100"
                  strokeDasharray="13 87"
                  strokeDashoffset="1"
                  opacity="0.23"
                />
                <ellipse
                  cx="218"
                  cy="297"
                  rx="137"
                  ry="104"
                  transform="rotate(-18 218 297)"
                  fill="none"
                  stroke="url(#ab-platinum-band)"
                  strokeWidth="27"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray="13 87"
                  strokeDashoffset="1"
                />
                <ellipse
                  cx="218"
                  cy="297"
                  rx="137"
                  ry="104"
                  transform="rotate(-18 218 297)"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray="9 91"
                  strokeDashoffset="2"
                  opacity="0.86"
                />
              </g>

              {/* Refined six-prong setting and faceted solitaire. */}
              <g transform="translate(369 151)">
                <path d="M -25 17 L -22 47 M 25 17 L 22 47" fill="none" stroke="#8c5e21" strokeWidth="8" strokeLinecap="round" opacity="0.38" />
                <path d="M -25 14 L -22 43 M 25 14 L 22 43" fill="none" stroke="url(#ab-gold-band)" strokeWidth="6" strokeLinecap="round" />
                <g className="ab-ring-svg__diamond">
                  <path d="M -38 -10 L -20 -32 L 20 -32 L 38 -10 L 0 34 Z" fill="#ffffff" opacity="0.45" filter="url(#ab-diamond-glow)" />
                  <path d="M -38 -10 L -20 -32 L 20 -32 L 38 -10 L 0 34 Z" fill="url(#ab-diamond)" stroke="#a7c9ce" strokeWidth="1.8" />
                  <path d="M -38 -10 L 38 -10 M -20 -32 L 0 -10 L 20 -32 M -38 -10 L 0 34 L 38 -10 M 0 -10 L 0 34" fill="none" stroke="#8eb8c1" strokeWidth="1.25" opacity="0.9" />
                  <path d="M -18 -29 L 0 -13 L 17 -29" fill="url(#ab-gem-flash)" opacity="0.9" />
                  <path d="M -33 -10 L -18 -28 M 33 -10 L 18 -28" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.92" />
                </g>
                <circle cx="-25" cy="-7" r="3.1" fill="#d5a64f" />
                <circle cx="25" cy="-7" r="3.1" fill="#d5a64f" />
              </g>

              {/* Small pavé accents lead the eye toward the solitaire. */}
              <g fill="#f8feff" stroke="#b68a43" strokeWidth="1.4">
                <circle cx="314" cy="190" r="4.4" />
                <circle cx="328" cy="183" r="4.1" />
                <circle cx="343" cy="178" r="3.8" />
                <circle cx="398" cy="190" r="3.8" />
                <circle cx="411" cy="199" r="4.1" />
              </g>
            </svg>

            <span className="ab-hero__sparkle ab-hero__sparkle--1" />
            <span className="ab-hero__sparkle ab-hero__sparkle--2" />
          </div>
        </motion.div>
      </section>

      {/* ── STATS BAR SECTION ───────────────────────────────── */}
      <section className="ab-stats-section">
        <div className="ss-container">
          <div className="ab-stats-grid">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="ab-stat-item"
                >
                  <div className="ab-stat-icon">
                    <Icon size={20} />
                  </div>
                  <div className="ab-stat-value">{stat.value}</div>
                  <div className="ab-stat-label">{stat.label}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── OUR STORY & MISSION SECTION ─────────────────────── */}
      <section id="our-story" className="ab-story-section">
        <div className="ss-container">
          <div className="ab-story-grid">
            
            {/* Story Left */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="ab-story-left"
            >
              <span className="ab-story-tag">Our Origin Story</span>
              <h2>
                Inspired by <em>Real Relationships</em>
              </h2>

              <p>
                In today’s fast-moving digital world, finding a genuine life partner can often feel overwhelming. Endless swiping, impersonal algorithms, and uncertainty can make an important milestone feel transactional.
              </p>

              <p>
                <strong>MyDearPartner was born from a simple belief:</strong> Finding your life partner should feel personal, respectful, and meaningful. We created a platform where technology supports genuine human connections without compromising values.
              </p>

              <div className="ab-story-highlights">
                {[
                  'Every profile represents a real, verified individual.',
                  'Every conversation carries the potential of a lasting future.',
                  'Every successful match is a milestone we celebrate together.'
                ].map((item, i) => (
                  <div key={i} className="ab-story-check-item">
                    <CheckCircle size={18} className="text-gold" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Mission & Vision Cards Right */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              {/* Mission Card */}
              <div className="ab-mission-card">
                <div className="ab-mission-card-header">
                  <div className="ab-mission-icon">
                    <Target size={22} />
                  </div>
                  <div>
                    <span className="ab-story-tag">Our Mission</span>
                    <h3>Helping You Find More Than a Match</h3>
                  </div>
                </div>
                <p>
                  Our mission is to create a trusted environment where meaningful relationships flourish naturally. By bringing together authenticity, privacy, and thoughtful matchmaking, we empower families and individuals to make life’s biggest decision with peace of mind.
                </p>
                <blockquote className="ab-mission-quote">
                  "Because marriage isn’t simply about finding someone. It’s about finding the right someone."
                </blockquote>
              </div>

              {/* Vision Card */}
              <div className="ab-mission-card">
                <div className="ab-mission-card-header">
                  <div className="ab-mission-icon">
                    <Globe size={22} />
                  </div>
                  <div>
                    <span className="ab-story-tag">Our Vision</span>
                    <h3>Every Relationship Begins with Trust</h3>
                  </div>
                </div>
                <p>
                  We envision a world where meaningful relationships are built on honesty, mutual respect, and shared values. Our goal is to be India's most trusted, family-friendly matrimony platform.
                </p>
                <blockquote className="ab-mission-quote">
                  "Where every introduction has purpose. Every conversation has meaning."
                </blockquote>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── DIFFERENTIATORS SECTION ─────────────────────────── */}
      <section className="ab-diff-section">
        <div className="ss-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="ab-section-header"
          >
            <span className="ab-story-tag">Why We Are Different</span>
            <h2>What Makes MyDearPartner Special</h2>
            <p>We prioritize genuine intentions, individual dignity, and family trust above simple algorithms.</p>
          </motion.div>

          <div className="ab-diff-grid">
            {differentiators.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="ab-diff-card"
                >
                  <div className="ab-diff-card-top">
                    <div className="ab-diff-icon-box">
                      <Icon size={24} />
                    </div>
                    <span className="ab-diff-tag">{item.tag}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CORE PILLARS SECTION ────────────────────────────── */}
      <section className="ab-pillars-section">
        <div className="ss-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="ab-section-header"
          >
            <span className="ab-story-tag" style={{ color: '#d9b36c' }}>Our Foundation</span>
            <h2 style={{ color: '#fff' }}>The Four Pillars of Our Platform</h2>
          </motion.div>

          <div className="ab-pillars-grid">
            {valuesList.map((val, i) => (
              <motion.div
                key={val.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="ab-pillar-card"
              >
                <div className="ab-pillar-num">0{i + 1}</div>
                <h3>{val.title}</h3>
                <p>{val.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER SECTION ──────────────────────────────── */}
      <section className="ab-cta-section">
        <div className="ss-container">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="ab-cta-box"
          >
            <span className="ab-story-tag" style={{ color: '#d9b36c' }}>Start Your Journey</span>
            <h2>
              Your Story Deserves
              <br />
              <em>the Right Beginning.</em>
            </h2>
            <p>
              Join thousands of verified profiles today. Take the first step toward finding a life partner who shares your values and aspirations.
            </p>

            <div className="ab-cta-actions">
              <Link to="/register" className="ab-btn-primary">
                Create Free Profile <ArrowRight size={16} />
              </Link>
              <Link to="/membership" className="ab-btn-secondary">
                View Membership Plans
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

    </main>
  );
}
