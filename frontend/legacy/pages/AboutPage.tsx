'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  HeartHandshake,
  UserCheck,
  Users,
  Target,
  Eye,
  Heart,
  LockKeyhole,
  UsersRound,
} from 'lucide-react';
import { Link } from '@/lib/router-compat';

const differentiators = [
  {
    icon: UserCheck,
    title: 'Authenticity Above Everything',
    desc: 'Every profile represents a genuine person looking for a meaningful relationship.',
    tag: 'Authentic',
  },
  {
    icon: ShieldCheck,
    title: 'Trust at Every Step',
    desc: 'From profile verification to privacy controls, every feature is designed to help you connect with confidence.',
    tag: 'Secure',
  },
  {
    icon: Heart,
    title: 'Relationships Before Algorithms',
    desc: 'Technology helps us recommend compatible matches, but people, values, and genuine intentions remain at the heart of every connection.',
    tag: 'People First',
  },
  {
    icon: Users,
    title: 'Designed for Individuals & Families',
    desc: 'Marriage brings two lives together—and often two families as well. That’s why MyDearPartner creates an experience that respects both personal choice and family involvement.',
    tag: 'Family First',
  },
];

const valuesList = [
  {
    title: 'Trust',
    desc: 'Every meaningful relationship begins with honesty.',
  },
  {
    title: 'Respect',
    desc: 'Every person, tradition, culture, and life story deserves respect.',
  },
  {
    title: 'Privacy',
    desc: 'Your personal information belongs to you & protecting it is our responsibility.',
  },
  {
    title: 'Commitment',
    desc: 'We’re committed to helping people build relationships that stand the test of time.',
  },
];

export default function AboutPage() {
  return (
    <main className="ab-page">
      {/* HERO SECTION */}
      <section className="ab-hero">
        <div className="ab-hero__container">
          <div className="ab-hero__grid">
            <motion.div
              className="ab-hero__left"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="ab-hero__badge">
                <Heart size={12} fill="currentColor" /> ABOUT MYDEARPARTNER
              </span>

              <h1>
                Every Forever Begins with a
                <em> Meaningful Connection.</em>
              </h1>

              <p className="ab-hero__lead">
                Some journeys in life are chosen. Others are shared. Finding the person who will stand beside you through every season of life is one of the most meaningful decisions you’ll ever make. At MyDearPartner, we believe that every relationship deserves a beginning built on trust, understanding, and genuine intentions.
              </p>

              <div className="ab-hero__ctas" style={{ marginTop: '2rem' }}>
                <Link to="/register" className="ab-btn-primary">
                  <Users size={16} /> Create Free Profile <ArrowRight size={16} />
                </Link>
                <a href="#our-story" className="ab-btn-secondary">
                  <HeartHandshake size={16} className="text-gold" /> Read Our Story
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* OUR STORY SECTION */}
      <section id="our-story" className="ab-story-section">
        <div className="ss-container">
          <div className="ab-story-grid">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="ab-story-left"
            >
              <span className="ab-story-tag">Our Story</span>
              <h2>
                Inspired by <em>Real Relationships</em>
              </h2>

              <p>
                In today’s fast-moving digital world, finding a genuine life partner can often feel overwhelming. Endless profiles, uncertain conversations, and a lack of trust can make an important journey unnecessarily difficult.
              </p>

              <p>
                <strong>MyDearPartner was born from a simple belief:</strong> Finding your life partner should feel personal, respectful, and meaningful, not complicated.
              </p>

              <p>
                That’s why we’ve created a platform where technology supports human connections without replacing the values that matter most.
              </p>

              <div className="ab-story-highlights">
                {[
                  'Every profile represents a real person.',
                  'Every conversation carries the possibility of a new beginning.',
                  'Every successful match becomes part of a story worth celebrating.'
                ].map((item, i) => (
                  <div key={i} className="ab-story-check-item">
                    <CheckCircle size={18} className="text-gold" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Mission & Vision Cards */}
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
                    <h3>Helping People Find More Than a Match</h3>
                  </div>
                </div>
                <p>
                  Our mission is to create a trusted environment where meaningful relationships can flourish naturally. By bringing together authenticity, privacy, and thoughtful matchmaking, we help individuals and families make one of life’s biggest decisions with confidence and peace of mind.
                </p>
                <blockquote className="ab-mission-quote">
                  "Because marriage isn’t simply about finding someone. It’s about finding the right someone."
                </blockquote>
              </div>

              {/* Vision Card */}
              <div className="ab-mission-card" style={{ marginTop: '1.5rem' }}>
                <div className="ab-mission-card-header">
                  <div className="ab-mission-icon">
                    <Eye size={22} />
                  </div>
                  <div>
                    <span className="ab-story-tag">Our Vision</span>
                    <h3>Creating a Future Where Every Relationship Begins with Trust</h3>
                  </div>
                </div>
                <p>
                  We dream of a world where meaningful relationships are built through honesty, respect, and shared values. Our vision is to become a platform that people don’t just use—but genuinely trust.
                </p>
                <blockquote className="ab-mission-quote">
                  "A place where every introduction has purpose. Every conversation has meaning. And every successful match becomes the beginning of a beautiful new chapter."
                </blockquote>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* DIFFERENTIATORS SECTION */}
      <section className="ab-diff-section">
        <div className="ss-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="ab-section-header"
          >
            <span className="ab-story-tag">What Makes Us Different</span>
            <h2>What Makes MyDearPartner Different</h2>
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

      {/* OUR VALUES SECTION */}
      <section className="ab-pillars-section">
        <div className="ss-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="ab-section-header"
          >
            <span className="ab-story-tag" style={{ color: '#d9b36c' }}>Our Principles</span>
            <h2 style={{ color: '#fff' }}>Our Values</h2>
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

      {/* WHY CHOOSE & PROMISE */}
      <section className="ab-story-section" style={{ background: '#fffaf7' }}>
        <div className="ss-container">
          <div className="ab-story-grid">
            <div className="ab-mission-card">
              <span className="ab-story-tag">For Your Journey</span>
              <h3 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', marginBottom: '1rem' }}>Why Choose MyDearPartner?</h3>
              <p style={{ fontWeight: 600, color: '#8e3d58', marginBottom: '0.75rem' }}>Because you’re not looking for another profile.</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={16} className="text-gold" /> You’re looking for someone who feels like home.</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={16} className="text-gold" /> Someone who understands your journey.</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={16} className="text-gold" /> Someone who shares your dreams.</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={16} className="text-gold" /> Someone with whom I feel forever natural.</li>
              </ul>
              <p style={{ marginTop: '1.25rem', fontWeight: 700 }}>At MyDearPartner, we’re honoured to be part of that journey.</p>
            </div>

            <div className="ab-mission-card">
              <span className="ab-story-tag">Our Commitment</span>
              <h3 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', marginBottom: '1rem' }}>A Promise From Us</h3>
              <p style={{ fontWeight: 600, color: '#8e3d58', marginBottom: '0.75rem' }}>
                We promise to create a space where meaningful relationships can begin with confidence.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={16} className="text-gold" /> A place where trust is earned.</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={16} className="text-gold" /> Where conversations are genuine.</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={16} className="text-gold" /> Where families feel secure.</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={16} className="text-gold" /> And where every introduction carries the possibility of a lifetime together.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CLOSING SECTION */}
      <section className="ab-cta-section">
        <div className="ss-container">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="ab-cta-box"
          >
            <span className="ab-story-tag" style={{ color: '#d9b36c' }}>Welcome to MyDearPartner</span>
            <h2>
              Your Story Deserves
              <br />
              <em>the Right Beginning.</em>
            </h2>
            <p>
              Every successful marriage begins with a single conversation. Every lasting relationship begins with a shared belief in tomorrow. And every beautiful future begins with one meaningful connection.
            </p>

            <div className="ab-cta-actions">
              <Link to="/register" className="ab-btn-primary">
                Create Free Profile <ArrowRight size={16} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
