import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Heart,
  HeartHandshake,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
  Target,
  Eye,
} from 'lucide-react';

const differentiators = [
  {
    icon: ShieldCheck,
    title: 'Authenticity Above Everything',
    text: 'Every profile represents a genuine person looking for a meaningful relationship.',
  },
  {
    icon: LockKeyhole,
    title: 'Trust at Every Step',
    text: 'From profile verification to privacy controls, every feature is designed to help you connect with confidence.',
  },
  {
    icon: HeartHandshake,
    title: 'Relationships Before Algorithms',
    text: 'Technology helps us recommend compatible matches, but people, values, and genuine intentions remain at the heart of every connection.',
  },
  {
    icon: UsersRound,
    title: 'Designed for Individuals & Families',
    text: 'Marriage brings two lives together—and often two families as well. That’s why MyDearPartner creates an experience that respects both personal choice and family involvement.',
  },
];

const valuesList = [
  {
    title: 'Trust',
    text: 'Every meaningful relationship begins with honesty.',
  },
  {
    title: 'Respect',
    text: 'Every person, tradition, culture, and life story deserves respect.',
  },
  {
    title: 'Privacy',
    text: 'Your personal information belongs to you & protecting it is our responsibility.',
  },
  {
    title: 'Commitment',
    text: 'We’re committed to helping people build relationships that stand the test of time.',
  },
];

export default function AboutPage() {
  return (
    <main className="overflow-hidden text-[#2c2928]">
      {/* Hero Section */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-[#eaf2e7] via-[#f7f2ed] to-[#fdebe6] px-5 pt-24 pb-16 sm:px-8 lg:pt-28 lg:pb-24">
        {/* Soft Background Ambient Light Glows */}
        <div className="absolute top-0 left-10 -z-20 h-72 w-72 rounded-full bg-emerald-200/35 blur-[80px]" />
        <div className="absolute right-10 top-1/4 -z-20 h-96 w-96 rounded-full bg-rose-200/40 blur-[100px]" />
        <div className="absolute left-1/3 bottom-10 -z-20 h-80 w-80 rounded-full bg-amber-100/50 blur-[90px]" />

        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
          {/* Left Hero Text Column */}
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl font-light leading-[1.08] tracking-[-.055em] text-[#2c2928] sm:text-5xl lg:text-6xl">
              Every Forever Begins with a{' '}
              <em className="font-serif font-normal italic text-[#bd6970]">
                Meaningful Connection.
              </em>
            </h1>

            <div className="mt-6 space-y-4 leading-relaxed text-slate-700">
              <p className="font-medium italic text-[#9e4e5e] text-lg sm:text-xl">
                Some journeys in life are chosen. Others are shared.
              </p>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                Finding the person who will stand beside you through every season of life is one of the most meaningful decisions you’ll ever make. At MyDearPartner, we believe that every relationship deserves a beginning built on trust, understanding, and genuine intentions.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center">
              <Link
                href="/register"
                className="group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full bg-[#8e3d58] px-8 text-sm font-extrabold text-white shadow-xl shadow-[#8e3d58]/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#742d45] hover:shadow-[#8e3d58]/35"
              >
                Create your profile{' '}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <a
                href="#our-story"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200/90 bg-white/90 px-8 text-sm font-extrabold text-[#4a2632] shadow-sm backdrop-blur-md transition-all duration-300 hover:bg-white hover:shadow-md"
              >
                Read Our Story
              </a>
            </div>

            {/* Key Pillars */}
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-200/60 pt-6 text-xs sm:text-sm font-bold text-slate-700">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-[#b64a68]" /> Authenticity first
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-[#b64a68]" /> Privacy &amp; Trust
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-[#b64a68]" /> Designed for Families
              </span>
            </div>
          </div>

          {/* Right Floating Card Stack Showcase */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            {/* Soft backdrop ambient light */}
            <div className="absolute -inset-5 rounded-[3.5rem] bg-gradient-to-br from-rose-200/50 via-amber-100/40 to-emerald-100/40 blur-2xl" />

            {/* Main Floating Image Card Frame */}
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/90 bg-white p-3.5 shadow-[0_25px_65px_rgba(62,22,39,.13)]">
              <Image
                src="/images/about-couple-hero.webp"
                alt="Couple sharing a meaningful connection"
                width={1122}
                height={1402}
                className="aspect-[4/5] w-full rounded-[2rem] object-cover"
                priority
              />

              {/* Gradient Bottom Overlay */}
              <div className="absolute inset-x-3.5 bottom-3.5 rounded-b-[2rem] bg-gradient-to-t from-[#20111a]/92 via-[#20111a]/40 to-transparent px-6 pb-6 pt-24 text-white">
                <p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-pink-300">
                  MYDEARPARTNER
                </p>
                <p className="mt-1.5 font-display text-2xl font-bold leading-tight">
                  Every forever begins with a meaningful connection.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section id="our-story" className="bg-white px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b64a68]">Our Story</p>
            <h2 className="mt-4 font-display text-3xl font-black tracking-[-.04em] text-[#20111a] sm:text-4xl lg:text-5xl">
              Inspired by Real Relationships
            </h2>
            <div className="mt-6 space-y-4 text-base sm:text-lg leading-8 text-slate-600">
              <p>
                In today’s fast-moving digital world, finding a genuine life partner can often feel overwhelming. Endless profiles, uncertain conversations, and a lack of trust can make an important journey unnecessarily difficult.
              </p>
              <div className="rounded-2xl border-l-4 border-[#8e3d58] bg-[#fffaf7] p-4 text-base font-semibold text-[#20111a]">
                MyDearPartner was born from a simple belief:<br />
                <span className="text-[#8e3d58]">Finding your life partner should feel personal, respectful, and meaningful, not complicated.</span>
              </div>
              <p>
                That’s why we’ve created a platform where technology supports human connections without replacing the values that matter most.
              </p>
            </div>

            <div className="mt-8 space-y-3 text-sm font-bold text-[#20111a]">
              <div className="flex items-center gap-3 rounded-xl bg-rose-50/60 p-3 text-[#8e3d58]">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#b64a68]" />
                <span>Every profile represents a real person.</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-rose-50/60 p-3 text-[#8e3d58]">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#b64a68]" />
                <span>Every conversation carries the possibility of a new beginning.</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-rose-50/60 p-3 text-[#8e3d58]">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#b64a68]" />
                <span>Every successful match becomes part of a story worth celebrating.</span>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/80 bg-white p-3 shadow-[0_18px_45px_rgba(62,22,39,.12)]">
            <Image src="/images/about-family-story.webp" alt="Families uniting happily" width={1704} height={960} className="aspect-[4/3] w-full rounded-[2rem] object-cover" />
          </div>
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="bg-[#fffaf7] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Our Mission */}
            <div className="rounded-[2.5rem] border border-[#3b1425]/10 bg-white p-8 sm:p-10 shadow-sm transition hover:shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-[#b64a68]">
                    <Target className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b64a68]">Our Mission</p>
                    <h3 className="text-2xl font-black text-[#20111a]">Helping People Find More Than a Match</h3>
                  </div>
                </div>
                <p className="mt-6 text-base sm:text-lg leading-8 text-slate-600">
                  Our mission is to create a trusted environment where meaningful relationships can flourish naturally. By bringing together authenticity, privacy, and thoughtful matchmaking, we help individuals and families make one of life’s biggest decisions with confidence and peace of mind.
                </p>
              </div>
              <div className="mt-6 rounded-2xl bg-rose-50/80 p-5 text-center font-display text-lg font-bold text-[#8e3d58]">
                “Because marriage isn’t simply about finding someone. It’s about finding the right someone.”
              </div>
            </div>

            {/* Our Vision */}
            <div className="rounded-[2.5rem] border border-[#3b1425]/10 bg-white p-8 sm:p-10 shadow-sm transition hover:shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-[#b64a68]">
                    <Eye className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b64a68]">Our Vision</p>
                    <h3 className="text-2xl font-black text-[#20111a]">Creating a Future Where Every Relationship Begins with Trust</h3>
                  </div>
                </div>
                <p className="mt-6 text-base sm:text-lg leading-8 text-slate-600">
                  We dream of a world where meaningful relationships are built through honesty, respect, and shared values. Our vision is to become a platform that people don’t just use—but genuinely trust.
                </p>
              </div>
              <ul className="mt-6 space-y-2 text-sm font-bold text-slate-700 bg-rose-50/40 p-4 rounded-2xl">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#b64a68]" /> A place where every introduction has purpose.</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#b64a68]" /> Every conversation has meaning.</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#b64a68]" /> Every successful match becomes the beginning of a beautiful new chapter.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* What Makes MyDearPartner Different */}
      <section className="bg-white px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b64a68]">Distinctive Experience</p>
            <h2 className="mt-4 font-display text-3xl font-black tracking-[-.04em] text-[#20111a] sm:text-4xl lg:text-5xl">
              What Makes MyDearPartner Different
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {differentiators.map(({ icon: Icon, title, text }, index) => (
              <article key={title} className="group rounded-[2rem] border border-[#3b1425]/8 bg-[#fffaf7] p-8 transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_20px_45px_rgba(62,22,39,.10)]">
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-[#b64a68]">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="font-display text-4xl font-black text-[#8e3d58]/15">0{index + 1}</span>
                </div>
                <h3 className="mt-6 text-xl font-extrabold text-[#20111a]">{title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Our Values Section */}
      <section className="bg-[#20111a] px-5 py-20 text-white sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-rose-300">Core Principles</p>
            <h2 className="mt-4 font-display text-3xl font-black tracking-[-.04em] sm:text-4xl lg:text-5xl">
              Our Values
            </h2>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {valuesList.map((val, i) => (
              <div key={val.title} className="rounded-2xl border border-white/10 bg-white/[.06] p-7 backdrop-blur-sm">
                <span className="font-display text-3xl font-black text-rose-300">0{i + 1}</span>
                <h3 className="mt-4 text-xl font-extrabold text-white">{val.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{val.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose MyDearPartner? & A Promise From Us */}
      <section className="bg-[#fffaf7] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
          {/* Why Choose */}
          <div className="rounded-[2.5rem] border border-[#3b1425]/10 bg-white p-8 sm:p-10 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b64a68]">For Your Journey</p>
              <h2 className="mt-3 font-display text-3xl font-black tracking-[-.04em] text-[#20111a]">
                Why Choose MyDearPartner?
              </h2>
              <div className="mt-6 space-y-3 text-base sm:text-lg leading-8 text-slate-700">
                <p className="font-semibold text-[#8e3d58]">Because you’re not looking for another profile.</p>
                <ul className="space-y-2 text-slate-600 text-base">
                  <li className="flex items-center gap-2"><Heart className="h-4 w-4 text-[#b64a68] shrink-0" /> You’re looking for someone who feels like home.</li>
                  <li className="flex items-center gap-2"><Heart className="h-4 w-4 text-[#b64a68] shrink-0" /> Someone who understands your journey.</li>
                  <li className="flex items-center gap-2"><Heart className="h-4 w-4 text-[#b64a68] shrink-0" /> Someone who shares your dreams.</li>
                  <li className="flex items-center gap-2"><Heart className="h-4 w-4 text-[#b64a68] shrink-0" /> Someone with whom I feel forever natural.</li>
                </ul>
              </div>
            </div>
            <p className="mt-6 font-semibold text-[#20111a] text-lg bg-rose-50/60 p-4 rounded-xl text-center">
              At MyDearPartner, we’re honoured to be part of that journey.
            </p>
          </div>

          {/* A Promise From Us */}
          <div className="rounded-[2.5rem] border border-[#3b1425]/10 bg-white p-8 sm:p-10 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b64a68]">Our Commitment</p>
              <h2 className="mt-3 font-display text-3xl font-black tracking-[-.04em] text-[#20111a]">
                A Promise From Us
              </h2>
              <div className="mt-6 space-y-3 text-base sm:text-lg leading-8 text-slate-700">
                <p className="font-semibold text-[#8e3d58]">
                  We promise to create a space where meaningful relationships can begin with confidence.
                </p>
                <ul className="space-y-2 text-slate-600 text-base">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#b64a68] shrink-0" /> A place where trust is earned.</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#b64a68] shrink-0" /> Where conversations are genuine.</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#b64a68] shrink-0" /> Where families feel secure.</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#b64a68] shrink-0" /> And where every introduction carries the possibility of a lifetime together.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Closing Section */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#8e3d58] to-[#b64a68] px-7 py-14 text-center text-white shadow-[0_24px_60px_rgba(142,61,88,.22)] sm:px-12">
          <h2 className="mx-auto mt-5 max-w-2xl font-display text-3xl font-black tracking-[-.04em] sm:text-4xl lg:text-5xl">
            Your Story Deserves the Right Beginning.
          </h2>
          <div className="mx-auto mt-6 max-w-xl space-y-2 text-base sm:text-lg leading-7 text-rose-100">
            <p>Every successful marriage begins with a single conversation.</p>
            <p>Every lasting relationship begins with a shared belief in tomorrow.</p>
            <p>And every beautiful future begins with one meaningful connection.</p>
          </div>
          <p className="mt-6 font-display text-2xl font-bold tracking-tight text-white">
            Welcome to MyDearPartner.
          </p>
          <div className="mt-8">
            <Link href="/register" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-7 text-sm font-extrabold text-[#8e3d58] transition hover:-translate-y-0.5 hover:shadow-xl">
              Start your journey <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
