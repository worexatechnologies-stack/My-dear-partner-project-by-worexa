'use client';

import React from 'react';
import Image from 'next/image';
import { Link } from '@/lib/router-compat';
import {
  Instagram, Facebook, Twitter, Linkedin, Youtube,
  Mail, MapPin, Phone, ShieldCheck, ArrowRight,
  Heart, Lock, UserCheck, Headphones
} from 'lucide-react';

const linkGroups = [
  {
    title: 'Explore',
    links: [
      { name: 'Search Matches', path: '/search' },
      { name: 'Success Stories', path: '/success-stories' },
      { name: 'Membership Plans', path: '/membership' },
      { name: 'Smart Matchmaker', path: '/matchmaking' },
      { name: 'About MyDearPartner', path: '/about' },
    ],
  },
  {
    title: 'Communities',
    links: [
      { name: 'Hindu Matrimony', path: '/search?religion=Hindu' },
      { name: 'Muslim Matrimony', path: '/search?religion=Muslim' },
      { name: 'Christian Matrimony', path: '/search?religion=Christian' },
      { name: 'Sikh Matrimony', path: '/search?religion=Sikh' },
      { name: 'Jain Matrimony', path: '/search?religion=Jain' },
    ],
  },
  {
    title: 'Help & Legal',
    links: [
      { name: 'Contact Support', path: '/contact' },
      { name: 'Privacy Policy', path: '/privacy' },
      { name: 'Terms of Service', path: '/terms' },
      { name: 'Customer Support', path: '/support' },
      { name: 'Safety & Trust', path: '/about#trust' },
    ],
  },
];

const socials = [
  { icon: Instagram, label: 'Instagram', href: 'https://www.instagram.com/my_dearpartnermatrimony?igsh=ZGsxd243c3dzNWM4' },
  { icon: Facebook, label: 'Facebook', href: '#' },
  { icon: Twitter, label: 'Twitter', href: '#' },
  { icon: Youtube, label: 'Youtube', href: '#' },
];

export default function Footer() {
  return (
    <footer className="bg-ink text-white pt-20 pb-10 border-t border-white/10 relative overflow-hidden">
      {/* Background ambient light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-rose-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Top Trust Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-16 border-b border-white/10 mb-16">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
              <ShieldCheck className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <h4 className="font-bold text-[15px] mb-1">100% Verified</h4>
              <p className="text-sm text-gray-400">Government ID checked profiles</p>
            </div>
          </div>
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
              <Lock className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <h4 className="font-bold text-[15px] mb-1">Total Privacy</h4>
              <p className="text-sm text-gray-400">You control who sees your photos</p>
            </div>
          </div>
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
              <UserCheck className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <h4 className="font-bold text-[15px] mb-1">Handpicked Matches</h4>
              <p className="text-sm text-gray-400">Curated by our smart algorithm</p>
            </div>
          </div>
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
              <Headphones className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <h4 className="font-bold text-[15px] mb-1">Dedicated Support</h4>
              <p className="text-sm text-gray-400">24/7 assistance on your journey</p>
            </div>
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">
          
          {/* Brand Column */}
          <div className="lg:col-span-4 space-y-6">
            <Link to="/" className="flex items-center gap-3 inline-block" aria-label="My Dear Partner Home">
              <img 
                src="/images/main-logo.png" 
                alt="My Dear Partner Logo" 
                className="w-10 h-10 object-contain drop-shadow-md" 
              />
              <span className="text-2xl font-black tracking-tight font-display text-white">
                MyDear<span className="text-pink-400">Partner</span>
              </span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              Bringing modern technology and timeless traditions together to help you find your perfect life partner in a safe, verified environment.
            </p>
            <div className="flex items-center gap-3 pt-2">
              {socials.map((social) => (
                <a 
                  key={social.label} 
                  href={social.href} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-rose-500 flex items-center justify-center text-gray-400 hover:text-white transition-all duration-300 hover:scale-110"
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Links Columns */}
          <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-8">
            {linkGroups.map((group) => (
              <div key={group.title}>
                <h4 className="text-white font-bold mb-6 tracking-wide text-[15px]">{group.title}</h4>
                <ul className="space-y-4">
                  {group.links.map((link) => (
                    <li key={link.name}>
                      <Link 
                        to={link.path}
                        className="text-gray-400 hover:text-rose-400 text-[14px] transition-colors flex items-center gap-2 group"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500/0 group-hover:bg-rose-400 transition-colors" />
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} MyDearPartner Matrimony. All rights reserved.</p>
          <div className="flex flex-col items-center md:items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              <span>Crafted with</span>
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              <span>for lasting relationships</span>
            </div>
            <div className="text-xs text-gray-400 flex items-center gap-2 mt-1">
              <img src="/images/main-logo.png" alt="My Dear Partner" className="w-5 h-5 object-contain" />
              <span>Built and developed by <strong className="text-gray-200">Worexa Technologies</strong></span>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
