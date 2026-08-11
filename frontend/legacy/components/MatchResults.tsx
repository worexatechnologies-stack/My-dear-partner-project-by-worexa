'use client';

import { m } from 'framer-motion';
import { ArrowLeft, CheckCircle, AlertTriangle, Shield, Network } from 'lucide-react';
import type { MatchResponse } from '../services/matchmakingApi';

interface MatchResultsProps {
  data: MatchResponse;
  onReset: () => void;
}

export default function MatchResults({ data, onReset }: MatchResultsProps) {
  const { total_score, max_total, conclusion, dimensions } = data;

  const scorePercentage = (total_score / max_total) * 100;
  const scoreScale = Math.min(Math.max(scorePercentage / 100, 0), 1);

  let scoreColor = 'text-red-600';
  let scoreBg = 'bg-red-50 border-red-200';

  if (total_score >= 70) {
    scoreColor = 'text-amber-600';
    scoreBg = 'bg-amber-50 border-amber-200';
  }
  if (total_score >= 85) {
    scoreColor = 'text-green-600';
    scoreBg = 'bg-green-50 border-green-200';
  }

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto"
    >
      <button type="button"
        onClick={onReset}
        className="mb-6 flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--theme-primary-600)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Run New Analysis
      </button>

      <div className="bg-white rounded-2xl shadow-lg border border-[var(--line)] overflow-hidden">

        {/* Score Header */}
        <div className={`p-8 text-center border-b border-[var(--line)] ${scoreBg}`}>
          {/* Circular score */}
          <div className="relative w-28 h-28 mx-auto mb-4">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" strokeWidth="8" />
              <m.circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={total_score >= 85 ? '#16a34a' : total_score >= 70 ? '#d97706' : '#c11111'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${scorePercentage * 2.64} 264`}
                initial={{ strokeDasharray: '0 264' }}
                animate={{ strokeDasharray: `${scorePercentage * 2.64} 264` }}
                transition={{ duration: 1.4, delay: 0.2 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold font-display ${scoreColor}`}>{total_score}</span>
              <span className="text-[var(--soft-muted)] text-xs font-medium">/{max_total}</span>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-[var(--ink)] font-display mb-2">
            Compatibility Report
          </h2>
          <div className="flex items-center justify-center gap-2 mb-4">
            {total_score >= 75 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                <CheckCircle className="w-3.5 h-3.5" /> Strong Compatibility Detected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-700 text-xs font-bold uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5" /> Moderate Compatibility
              </span>
            )}
          </div>

          {/* Score bar */}
          <div className="max-w-xs mx-auto">
            <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
              <span>0</span>
              <span className="font-bold text-[var(--ink)]">{scorePercentage.toFixed(0)}% Match</span>
              <span>100</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <m.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: scoreScale }}
                transition={{ duration: 1.2, delay: 0.3 }}
                className="h-2.5 w-full origin-left rounded-full gradient-primary"
              />
            </div>
          </div>
        </div>

        {/* Report Body */}
        <div className="p-8">

          {/* Conclusion */}
          <div className="mb-10">
            <h3 className="text-xl font-bold text-[var(--ink)] flex items-center gap-2 mb-4">
              <Network className="w-5 h-5 text-[var(--theme-secondary-500)]" />
              Compatibility Insights
            </h3>
            <div className="text-[var(--ink)] leading-relaxed bg-[var(--surface-strong)] p-6 rounded-2xl border border-[var(--line)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full gradient-primary" />
              <p className="font-medium text-base pl-2">{conclusion}</p>
            </div>
          </div>

          {/* Dimension breakdown */}
          <h3 className="text-xl font-bold text-[var(--ink)] flex items-center gap-2 mb-6">
            <Network className="w-5 h-5 text-[var(--theme-primary-600)]" />
            Dimension Breakdown
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            {dimensions.map((dim, index) => {
              const dimPct = (dim.score / dim.max_score) * 100;
              const dimScale = Math.min(Math.max(dimPct / 100, 0), 1);
              return (
                <div
                  key={index}
                  className="bg-[var(--surface-strong)] border border-[var(--line)] rounded-xl p-5 hover:border-[var(--theme-primary-400)] transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-[var(--ink)] mb-1">{dim.name}</h4>
                      <p className="text-xs text-[var(--muted)]">{dim.description}</p>
                    </div>
                    <div className="flex items-baseline gap-1 ml-3 shrink-0">
                      <span className="text-xl font-display font-bold text-[var(--theme-primary-600)]">
                        {dim.score}
                      </span>
                      <span className="text-xs text-[var(--soft-muted)]">/{dim.max_score}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4 overflow-hidden">
                    <m.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: dimScale }}
                      transition={{ duration: 1, delay: 0.2 + index * 0.1 }}
                      className="gradient-primary h-1.5 w-full origin-left rounded-full"
                    />
                  </div>

                  <p className="text-sm text-gray-700 leading-relaxed border-t border-gray-100 pt-3">
                    <span className="text-[var(--theme-primary-700)] font-bold mr-1">Insight:</span>
                    {dim.insight}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Disclaimer */}
          <div className="mt-8 flex items-start gap-3 p-4 rounded-xl bg-[var(--theme-primary-50)] border border-[var(--line)]">
            <Shield className="w-4 h-4 text-[var(--theme-primary-600)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              This compatibility report is generated using a deterministic scoring algorithm based on
              personality type, career, and core values. It is intended as a helpful guide and should
              be used alongside real conversations and mutual understanding.
            </p>
          </div>
        </div>
      </div>
    </m.div>
  );
}
