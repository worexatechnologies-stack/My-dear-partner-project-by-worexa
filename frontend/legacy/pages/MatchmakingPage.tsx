'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Search, Network, Heart, CheckCircle2, HeartHandshake } from 'lucide-react';
import { getCompatibilityMatch, type MatchRequest } from '../services/matchmakingApi';
import MatchResults from '../components/MatchResults';

const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

const CAREERS = [
  'Engineering/Tech',
  'Medicine/Healthcare',
  'Business/Finance',
  'Arts/Design',
  'Education',
  'Law',
  'Science/Research',
];

const VALUES = [
  'Family First',
  'Career Ambition',
  'Adventure & Travel',
  'Spiritual Growth',
  'Community Impact',
  'Financial Independence',
];

export default function MatchmakingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any | null>(null);

  const [p1Details, setP1Details] = useState({
    name: '',
    mbti: 'INTJ',
    career: 'Engineering/Tech',
    values: 'Family First',
  });

  const [p2Details, setP2Details] = useState({
    name: '',
    mbti: 'ENFP',
    career: 'Arts/Design',
    values: 'Adventure & Travel',
  });

  const handleMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    const requestData: MatchRequest = {
      p1_name: p1Details.name,
      p1_mbti: p1Details.mbti,
      p1_career: p1Details.career,
      p1_values: p1Details.values,
      p2_name: p2Details.name,
      p2_mbti: p2Details.mbti,
      p2_career: p2Details.career,
      p2_values: p2Details.values,
    };

    try {
      const data = await getCompatibilityMatch(requestData);
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Compatibility analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100svh] overflow-x-hidden bg-[radial-gradient(circle_at_8%_5%,rgba(253,222,232,0.9),transparent_28%),radial-gradient(circle_at_92%_20%,rgba(244,211,221,0.6),transparent_26%),#fcfaf9] pb-16 pt-24 sm:pt-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

        {/* Page Header */}
        <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-100 bg-white/80 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#a23b5b] shadow-sm">
            <HeartHandshake className="h-4 w-4 text-[#d34870]" />
            Compatibility studio
          </div>
          <h1 className="mb-3 font-display text-3xl font-black tracking-tight text-[#321724] sm:text-5xl">
            Explore your connection
          </h1>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-500 sm:text-base">
            Bring two profiles together and discover the values, lifestyle, and personality traits they share.
          </p>
        </div>

        {/* How it works — only shown when no results */}
        {!results && (
          <div className="mx-auto mb-8 grid max-w-4xl grid-cols-1 gap-3 sm:mb-10 sm:grid-cols-3 sm:gap-4">
            {[
              { icon: User, step: '1', title: 'Enter Details', desc: 'Fill in personality type, career, and core values for both partners.' },
              { icon: Search, step: '2', title: 'Run Analysis', desc: 'Our engine scores compatibility across 4 key life dimensions.' },
              { icon: CheckCircle2, step: '3', title: 'Read Report', desc: 'Get a detailed compatibility report with actionable insights.' },
            ].map(({ icon: Icon, step, title, desc }) => (
              <div key={step} className="rounded-[1.5rem] border border-rose-100/80 bg-white/80 p-5 text-center shadow-[0_14px_35px_-28px_rgba(91,23,53,0.55)] backdrop-blur-sm">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff0f4]">
                  <Icon className="h-5 w-5 text-[#c14568]" />
                </div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#c14568]">Step {step}</p>
                <h3 className="mb-1 text-sm font-black text-[#3c2230] sm:text-base">{title}</h3>
                <p className="text-xs leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        )}

        {results ? (
          <MatchResults data={results} onReset={() => setResults(null)} />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-5xl"
          >
            <form onSubmit={handleMatch} className="relative overflow-hidden rounded-[2rem] border border-rose-100 bg-white/90 p-5 shadow-[0_28px_70px_-42px_rgba(91,23,53,0.5)] backdrop-blur-sm sm:p-8">
              {/* Top accent bar */}
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#b63d61] via-[#ef6d92] to-[#f7c3d2]" />

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">

                {/* Partner 1 */}
                <div className="rounded-[1.5rem] border border-rose-100 bg-[#fffafb] p-5 sm:p-6">
                  <div className="mb-5 flex items-center gap-3 border-b border-rose-100 pb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fce7ed]">
                      <User className="h-5 w-5 text-[#bc4264]" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-black text-[#3c2230] sm:text-xl">Person one</h2>
                      <p className="text-xs text-slate-500">Start with the first profile</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wider">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={p1Details.name}
                        onChange={(e) => setP1Details({ ...p1Details, name: e.target.value })}
                        className="hero-field w-full text-sm sm:text-base py-3 px-4 rounded-xl border border-[var(--line)] focus:outline-none focus:border-[var(--theme-primary-500)]"
                        placeholder="Enter name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wider">
                        Personality Type (MBTI)
                      </label>
                      <select
                        value={p1Details.mbti}
                        onChange={(e) => setP1Details({ ...p1Details, mbti: e.target.value })}
                        className="hero-field w-full text-sm sm:text-base py-3 px-4 rounded-xl border border-[var(--line)] focus:outline-none focus:border-[var(--theme-primary-500)] bg-white cursor-pointer"
                        required
                      >
                        {MBTI_TYPES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wider">
                        Career Field
                      </label>
                      <select
                        value={p1Details.career}
                        onChange={(e) => setP1Details({ ...p1Details, career: e.target.value })}
                        className="hero-field w-full text-sm sm:text-base py-3 px-4 rounded-xl border border-[var(--line)] focus:outline-none focus:border-[var(--theme-primary-500)] bg-white cursor-pointer"
                        required
                      >
                        {CAREERS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wider">
                        Core Life Value
                      </label>
                      <select
                        value={p1Details.values}
                        onChange={(e) => setP1Details({ ...p1Details, values: e.target.value })}
                        className="hero-field w-full text-sm sm:text-base py-3 px-4 rounded-xl border border-[var(--line)] focus:outline-none focus:border-[var(--theme-primary-500)] bg-white cursor-pointer"
                        required
                      >
                        {VALUES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Partner 2 */}
                <div className="rounded-[1.5rem] border border-rose-100 bg-[#fffafb] p-5 sm:p-6">
                  <div className="mb-5 flex items-center gap-3 border-b border-rose-100 pb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fce7ed]">
                      <Network className="h-5 w-5 text-[#bc4264]" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-black text-[#3c2230] sm:text-xl">Person two</h2>
                      <p className="text-xs text-slate-500">Add the profile to compare</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wider">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={p2Details.name}
                        onChange={(e) => setP2Details({ ...p2Details, name: e.target.value })}
                        className="hero-field w-full text-sm sm:text-base py-3 px-4 rounded-xl border border-[var(--line)] focus:outline-none focus:border-[var(--theme-primary-500)]"
                        placeholder="Enter name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wider">
                        Personality Type (MBTI)
                      </label>
                      <select
                        value={p2Details.mbti}
                        onChange={(e) => setP2Details({ ...p2Details, mbti: e.target.value })}
                        className="hero-field w-full text-sm sm:text-base py-3 px-4 rounded-xl border border-[var(--line)] focus:outline-none focus:border-[var(--theme-primary-500)] bg-white cursor-pointer"
                        required
                      >
                        {MBTI_TYPES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wider">
                        Career Field
                      </label>
                      <select
                        value={p2Details.career}
                        onChange={(e) => setP2Details({ ...p2Details, career: e.target.value })}
                        className="hero-field w-full text-sm sm:text-base py-3 px-4 rounded-xl border border-[var(--line)] focus:outline-none focus:border-[var(--theme-primary-500)] bg-white cursor-pointer"
                        required
                      >
                        {CAREERS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wider">
                        Core Life Value
                      </label>
                      <select
                        value={p2Details.values}
                        onChange={(e) => setP2Details({ ...p2Details, values: e.target.value })}
                        className="hero-field w-full text-sm sm:text-base py-3 px-4 rounded-xl border border-[var(--line)] focus:outline-none focus:border-[var(--theme-primary-500)] bg-white cursor-pointer"
                        required
                      >
                        {VALUES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-6 sm:mt-8 p-4 bg-red-50 text-red-600 rounded-xl text-xs sm:text-sm font-medium border border-red-200 text-center">
                  {error}
                </div>
              )}

              <div className="mt-8 sm:mt-10 flex justify-center">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex min-w-full items-center justify-center gap-2 rounded-2xl bg-[#b63d61] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-200 transition-all hover:-translate-y-0.5 hover:bg-[#972e4d] active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[320px] sm:text-base"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analysing Compatibility...
                    </>
                  ) : (
                    <>
                      <Heart className="w-5 h-5 fill-current" />
                      Generate Compatibility Report
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
}
