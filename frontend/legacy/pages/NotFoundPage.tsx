'use client';

import React from 'react';
import { FileQuestion, Home, ArrowLeft, HelpCircle, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from '@/lib/router-compat';

export default function NotFoundPage() {
  const navigate = useNavigate();

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2rem] shadow-xl border border-gray-100 p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r gradient-primary" />
        
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-100/50 text-[var(--theme-primary-600)]">
          <FileQuestion className="w-10 h-10" />
        </div>
        
        <h1 className="text-5xl font-black text-gray-900 mb-2 font-display">404</h1>
        <h2 className="text-xl font-bold text-gray-800 mb-3">Page Not Found</h2>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          The page you requested doesn't exist, has been archived, or the URL address has been misspelled.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3 bg-[var(--theme-primary-600)] text-white hover:bg-[var(--theme-primary-700)] rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleRetry}
              className="py-2.5 border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer bg-white transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Load
            </button>
            <Link
              to="/support"
              className="py-2.5 border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 bg-white transition-all"
            >
              <HelpCircle className="w-3.5 h-3.5 text-gray-500" /> Support Desk
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
