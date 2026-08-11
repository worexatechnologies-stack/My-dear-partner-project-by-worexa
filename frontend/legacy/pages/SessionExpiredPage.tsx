'use client';

import React from 'react';
import { Clock, LogIn, HelpCircle } from 'lucide-react';
import { useNavigate, Link } from '@/lib/router-compat';
import { useAuth } from '../contexts/AuthContext';

export default function SessionExpiredPage() {
  const navigate = useNavigate();
  const { accountType } = useAuth();

  const handleLogin = () => {
    const type = accountType || 'MEMBER';
    if (type === 'MEMBER') navigate('/login');
    else if (type === 'SUPER_ADMIN') navigate('/super-admin/login');
    else navigate(`/${type.toLowerCase().replace('_', '-')}/login`);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2rem] shadow-xl border border-gray-100 p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r gradient-primary" />
        
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-100/50 text-amber-500 animate-pulse">
          <Clock className="w-10 h-10" />
        </div>
        
        <h1 className="text-2xl font-black text-gray-900 mb-3 font-display">Session Expired</h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          For your security, your session has timed out due to inactivity. Please log back in to access your dashboard.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleLogin}
            className="w-full py-3 bg-[var(--theme-primary-600)] text-white hover:bg-[var(--theme-primary-700)] rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm text-sm"
          >
            <LogIn className="w-4 h-4" /> Log In Again
          </button>
          
          <Link
            to="/support"
            className="w-full py-2.5 border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 bg-white transition-all"
          >
            <HelpCircle className="w-3.5 h-3.5 text-gray-500" /> Need Help? Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
