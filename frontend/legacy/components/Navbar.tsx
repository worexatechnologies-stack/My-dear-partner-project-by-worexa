'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { Link, useLocation, useNavigate } from '@/lib/router-compat';
import {
  Menu, X, Heart, LogIn, LogOut, Search, User, Bell, Settings, Bookmark,
  CreditCard, HelpCircle, ChevronDown, ShieldCheck, Scale
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supportService } from '../services/supportService';
import SmartImage from '@/components/shared/smart-image';
import { motion, AnimatePresence } from 'framer-motion';

const publicLinks = [
  { name: 'Home', path: '/' },
  { name: 'About', path: '/about' },
  { name: 'Stories', path: '/success-stories' },
  { name: 'Membership', path: '/membership' },
  { name: 'Contact', path: '/contact' },
];

const memberLinks = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Matches', path: '/search' },
  { name: 'Compare', path: '/compare' },
  { name: 'Messages', path: '/messages' },
  { name: 'Membership', path: '/membership' },
  { name: 'Support', path: '/support' },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isAuthenticated || user?.account_type !== 'MEMBER') {
      setUnreadCount(0);
      return;
    }
    const fetchUnread = async () => {
      try {
        const res = await supportService.getUnreadNotificationsCount();
        setUnreadCount(res.unread_count || 0);
      } catch (err) {
        console.error('Failed to load notifications count:', err);
      }
    };
    void fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, user]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const isMember = isAuthenticated && user?.account_type === 'MEMBER';
  const navLinks = isMember ? memberLinks : publicLinks;
  const isActive = (path: string) => location.pathname === path;
  // Navbar always uses a white background

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const memberInitials = user?.full_name
    ? user.full_name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()
    : 'U';

  return (
    <header className={`fixed top-4 left-0 right-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] max-w-[1400px] mx-auto px-4 sm:px-6`}>
      <motion.div 
        layout
        className={`w-full flex items-center justify-between gap-4 rounded-[2.5rem] transition-all duration-500 ${
          isScrolled 
            ? 'bg-white/80 backdrop-blur-xl shadow-brand-md border border-white/40 h-[72px] px-6 sm:px-8' 
            : 'bg-white/95 backdrop-blur-xl shadow-sm border border-white/40 h-[88px] px-4 sm:px-6'
        }`}
      >
        {/* Brand Logo */}
        <div className="flex items-center gap-10 shrink-0 h-full">
          <Link to="/" className="flex items-center gap-3 group cursor-pointer h-full" aria-label="My Dear Partner Home">
            <img 
              src="/images/main-logo.png" 
              alt="My Dear Partner Logo" 
              className="w-10 h-10 object-contain transition-transform duration-500 group-hover:scale-110" 
            />
            <span className="text-xl sm:text-2xl font-black tracking-tight font-display transition-colors duration-300 text-slate-900 drop-shadow-xs">
              MyDear<span className="text-[#f472b6] drop-shadow-xs">Partner</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1.5 h-full" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative px-5 py-2.5 rounded-[1.25rem] text-[13px] font-bold transition-all duration-300 cursor-pointer overflow-hidden group ${
                    active
                      ? 'text-rose-700'
                      : 'text-gray-600 hover:text-rose-600'
                  }`}
                >
                  <span className="relative z-10">{link.name}</span>
                  {active && (
                    <motion.div layoutId="nav-pill" className="absolute inset-0 border rounded-[1.25rem] -z-10 bg-rose-50 border-rose-100/50" />
                  )}
                  {!active && (
                    <div className="absolute inset-0 rounded-[1.25rem] -z-10 transition-colors duration-300 bg-rose-50/0 group-hover:bg-rose-50/50" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">


          {/* Notifications Bell Button */}
          {isMember && (
            <Link
              to="/notifications"
              className="relative flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300 shadow-sm backdrop-blur-md hover:shadow-md bg-white/50 hover:bg-white border-gray-200 text-gray-600 hover:text-rose-600"
              aria-label="Notifications"
            >
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-4 ring-white" />
              )}
            </Link>
          )}

          {/* Authenticated User Menu or Public Action CTAs */}
          {isAuthenticated ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 p-1.5 pr-4 rounded-full shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer backdrop-blur-md bg-white/60 hover:bg-white border-gray-200 text-ink"
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
              >
                {user?.photo ? (
                  <SmartImage
                    src={user.photo}
                    alt={user.full_name}
                    className="w-8 h-8 rounded-full object-cover shadow-sm"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 text-white text-xs font-black flex items-center justify-center shadow-sm">
                    {memberInitials}
                  </div>
                )}
                <span className="hidden sm:block text-[13px] font-bold truncate max-w-[100px] drop-shadow-sm">
                  {user?.first_name || 'Account'}
                </span>
                <ChevronDown className={`hidden sm:block w-3.5 h-3.5 transition-transform duration-300 text-gray-400 ${isDropdownOpen ? 'rotate-180 text-rose-500' : ''}`} />
              </button>

              {/* Profile Dropdown Panel */}
              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 top-[calc(100%+8px)] w-64 bg-white/95 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-brand-lg p-2 z-50 overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-gradient-to-br from-rose-50/80 to-transparent rounded-t-[1.75rem] border-b border-rose-100/50 mb-1">
                      <p className="text-[10px] font-extrabold text-rose-500/80 uppercase tracking-widest mb-0.5">Signed in as</p>
                      <p className="text-sm font-black text-ink truncate">{user?.full_name}</p>
                    </div>

                    <div className="p-1 space-y-0.5">
                      <Link to="/profile/me" className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[13px] font-bold text-gray-600 hover:bg-gray-50 hover:text-ink transition-colors group">
                        <User className="w-4 h-4 text-gray-400 group-hover:text-rose-500 transition-colors" /> My Profile
                      </Link>

                      {isMember && (
                        <>
                          <Link to="/interests/sent" className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[13px] font-bold text-gray-600 hover:bg-gray-50 hover:text-ink transition-colors group">
                            <Heart className="w-4 h-4 text-gray-400 group-hover:text-rose-500 transition-colors" /> Sent Interests
                          </Link>
                          <Link to="/shortlist" className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[13px] font-bold text-gray-600 hover:bg-gray-50 hover:text-ink transition-colors group">
                            <Bookmark className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors" /> Saved Shortlists
                          </Link>
                          <Link to="/interests/declined" className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[13px] font-bold text-gray-600 hover:bg-gray-50 hover:text-ink transition-colors group">
                            <ShieldCheck className="w-4 h-4 text-gray-400 group-hover:text-amber-500 transition-colors" /> Declined Requests (Undo)
                          </Link>
                          <Link to="/settings/profile" className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[13px] font-bold text-gray-600 hover:bg-gray-50 hover:text-ink transition-colors group">
                            <Settings className="w-4 h-4 text-gray-400 group-hover:text-rose-500 transition-colors" /> Settings
                          </Link>
                          <Link to="/membership" className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[13px] font-bold text-gray-600 hover:bg-gray-50 hover:text-ink transition-colors group">
                            <CreditCard className="w-4 h-4 text-gray-400 group-hover:text-rose-500 transition-colors" /> Membership
                          </Link>
                          <Link to="/support" className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[13px] font-bold text-gray-600 hover:bg-gray-50 hover:text-ink transition-colors group">
                            <HelpCircle className="w-4 h-4 text-gray-400 group-hover:text-rose-500 transition-colors" /> Support
                          </Link>
                        </>
                      )}
                    </div>

                    <div className="p-1 mt-1 border-t border-gray-100">
                      <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[13px] font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer group">
                        <LogOut className="w-4 h-4 text-rose-400 group-hover:text-rose-600 transition-colors" /> Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-2">
              <Link
                to="/login"
                className="px-5 py-2.5 rounded-full text-[13px] font-bold transition-colors text-ink hover:bg-white/60"
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="px-6 py-2.5 rounded-full font-bold text-[13px] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 bg-ink text-white hover:bg-gray-800"
              >
                Create Account
              </Link>
            </div>
          )}

          {/* Hamburger Mobile Menu Button */}
          <button
            type="button"
            className="lg:hidden flex items-center justify-center w-11 h-11 rounded-full shadow-sm backdrop-blur-md cursor-pointer transition-colors bg-white/50 hover:bg-white border-gray-200 text-ink"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </motion.div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="lg:hidden absolute top-[calc(100%+8px)] left-4 right-4 bg-white/95 backdrop-blur-xl border border-white/60 p-6 rounded-[2rem] shadow-brand-lg"
          >
            {isMember && (
              <form onSubmit={handleSearchSubmit} className="relative mb-6">
                <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search matches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-50/50 border border-gray-200 text-[13px] font-bold pl-11 pr-4 py-3 rounded-2xl text-ink focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 transition-all"
                />
              </form>
            )}

            <div className="space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`block px-5 py-3.5 rounded-2xl text-[14px] font-bold transition-all ${
                    isActive(link.path)
                      ? 'bg-rose-50 text-rose-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-ink'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
            </div>

            <div className="pt-6 mt-6 border-t border-gray-100">
              {isAuthenticated ? (
                <button
                  type="button"
                  className="w-full py-3.5 rounded-2xl bg-rose-50/50 hover:bg-rose-50 text-rose-600 text-[14px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <Link
                    to="/register"
                    className="w-full py-3.5 text-center rounded-2xl bg-ink text-white font-bold text-[14px] shadow-lg"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Create Account
                  </Link>
                  <Link
                    to="/login"
                    className="w-full py-3.5 text-center rounded-2xl border border-gray-200 text-ink font-bold text-[14px]"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Log In
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
