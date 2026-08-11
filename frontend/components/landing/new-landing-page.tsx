'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Heart, ShieldCheck } from 'lucide-react';
import SmartImage from '@/components/shared/smart-image';

const stories = [
  { src: '/images/success_story_1.png', alt: 'A happy couple celebrating their story', className: 'col-span-2 row-span-2' },
  { src: '/images/bride-portrait.jpg', alt: 'Member portrait', className: '' },
  { src: '/images/couple-sunset.jpg', alt: 'Couple at sunset', className: '' },
  { src: '/images/success_story_2.png', alt: 'Happy couple', className: 'col-span-2' },
];

const profiles = [
  ['Ananya', 'Bengaluru', '/images/about-couple-hero.webp'],
  ['Arjun', 'Mumbai', '/images/matrimony-hero-couple.webp'],
  ['Meera', 'Pune', '/images/about-family-story.webp'],
  ['Kabir', 'Delhi', '/images/wedding-rings.jpg'],
];

export default function NewLandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const check = () => {
      const stored = typeof window !== 'undefined' && window.localStorage.getItem('mdp.auth.authenticated') === 'true';
      setIsLoggedIn(stored);
    };
    check();
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);
  return (
    <div className="overflow-hidden bg-[#fffefd] text-[#2c2928]">
      <section className="relative isolate min-h-[660px] overflow-hidden bg-[#f4eee8] pt-24 sm:min-h-[720px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_30%,rgba(184,207,175,.48),transparent_24%),radial-gradient(circle_at_86%_18%,rgba(255,255,255,.9),transparent_31%),linear-gradient(105deg,#fbf8f4_8%,#f5eee8_50%,#dce4d5_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-[#fffefd] [clip-path:polygon(0_64%,100%_0,100%_100%,0_100%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-6 pb-24 sm:px-10 lg:grid-cols-[.82fr_1.18fr] lg:px-14">
          <div className="z-10 pt-12 lg:pt-4">
            <p className="mb-6 font-display text-[10px] font-bold uppercase tracking-[.35em] text-[#b66068]">Made for meaningful matches</p>
            <h1 className="max-w-md font-display text-5xl font-light leading-[.92] tracking-[-.065em] text-[#292425] sm:text-6xl lg:text-7xl">
              Choose your <em className="font-serif font-normal text-[#bd6970]">soulmate.</em>
            </h1>
            <p className="mt-6 max-w-sm text-base leading-7 text-stone-600">Meet verified people who share your values, hopes and idea of a lasting partnership.</p>
            {isLoggedIn ? (
              <Link href="/dashboard" className="mt-8 inline-flex items-center gap-3 border border-[#bd6970] bg-[#bd6970] px-5 py-3 text-xs font-bold uppercase tracking-[.14em] text-white transition hover:bg-[#a8525c]">
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link href="/register" className="mt-8 inline-flex items-center gap-3 border border-[#bd6970] bg-white/75 px-5 py-3 text-xs font-bold uppercase tracking-[.14em] text-[#9e4e59] transition hover:bg-[#bd6970] hover:text-white">
                Begin your story <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          <div className="relative h-[420px] self-end sm:h-[510px] lg:h-[590px]">
            <div className="absolute inset-x-[7%] bottom-0 top-5 overflow-hidden rounded-t-[12rem] bg-[#d6dfce] shadow-[0_28px_60px_rgba(64,52,43,.16)] sm:inset-x-[12%]">
              <SmartImage src="/images/landing-hero-couple-v3.png" alt="A couple beginning their journey together" className="h-full w-full object-cover object-center" priority />
              <div className="absolute inset-0 bg-gradient-to-t from-[#5e554a]/20 via-transparent to-white/10" />
            </div>
            <div className="absolute right-0 top-10 hidden rounded-full border border-white/70 bg-white/75 p-4 text-[#bd6970] shadow-lg backdrop-blur sm:block"><Heart className="h-6 w-6 fill-current" /></div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:px-10 lg:grid-cols-2 lg:items-center lg:px-14 lg:py-28">
        <div className="relative order-2 grid aspect-square max-w-[470px] grid-cols-3 grid-rows-3 gap-2 lg:order-1">
          {stories.map((story) => <div key={story.src} className={`overflow-hidden ${story.className}`}><SmartImage src={story.src} alt={story.alt} className="h-full w-full object-cover" /></div>)}
          <div className="pointer-events-none absolute -left-5 -top-5 h-[58%] w-[62%] border border-[#c9696c] sm:-left-8 sm:-top-8" />
        </div>
        <div className="order-1 lg:order-2">
          <p className="font-display text-[10px] font-bold uppercase tracking-[.32em] text-[#bd6970]">Real connections</p>
          <h2 className="mt-4 font-display text-4xl font-light tracking-[-.05em] sm:text-5xl">Love stories begin with a hello.</h2>
          <p className="mt-6 max-w-md leading-7 text-stone-600">A thoughtful profile and a sincere introduction can change everything. We make it easier to discover people whose future looks like yours.</p>
          <Link href="/success-stories" className="mt-7 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#a8525c] hover:text-[#7d3a44]">Explore success stories <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <section className="relative bg-[#f25d61] px-6 py-16 text-white sm:px-10 lg:px-14">
        <div className="absolute inset-x-0 top-0 h-8 bg-[#fffefd] [clip-path:polygon(0_0,100%_100%,100%_0)]" />
        <div className="mx-auto max-w-6xl pt-4"><h2 className="text-center font-display text-3xl font-light tracking-[-.04em] sm:text-4xl">Tired of being alone?</h2>
          <div className="mt-10 grid gap-8 text-center sm:grid-cols-4">{[
            ['01', 'Create your profile'], ['02', 'Share what matters'], ['03', 'Discover compatible people'], ['04', 'Start a conversation'],
          ].map(([number, label]) => <div key={number}><span className="font-display text-4xl font-light text-white/35">{number}</span><p className="mt-2 text-[11px] font-bold uppercase tracking-[.13em] text-white/90">{label}</p></div>)}</div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 py-20 sm:px-10 lg:px-14 lg:py-28">
        <div className="absolute bottom-0 left-0 hidden h-[78%] w-[31%] overflow-hidden lg:block"><SmartImage src="/images/matrimony-hero-couple.webp" alt="Happy couple" className="h-full w-full object-cover object-top" /></div>
        <div className="lg:ml-[31%]">
          <p className="font-display text-[10px] font-bold uppercase tracking-[.32em] text-[#bd6970]">Meet someone new</p>
          <h2 className="mt-4 font-display text-4xl font-light tracking-[-.05em] sm:text-5xl">Recently added profiles</h2>
          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-4">
            {profiles.map(([name, city, image]) => <Link href={isLoggedIn ? "/search" : "/register"} key={name} className="group text-center"><div className="mx-auto aspect-square w-full max-w-32 overflow-hidden rounded-full border-4 border-[#f9eeee] bg-stone-100"><SmartImage src={image} alt={`${name}'s profile`} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" /></div><h3 className="mt-3 text-xs font-bold uppercase tracking-[.1em] text-stone-800">{name}</h3><p className="mt-1 text-[10px] uppercase tracking-[.12em] text-[#bd6970]">{city}</p></Link>)}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-stone-200 pt-6"><p className="flex items-center gap-2 text-sm text-stone-600"><ShieldCheck className="h-4 w-4 text-[#bd6970]" /> Every introduction begins with care.</p><Link href={isLoggedIn ? "/dashboard" : "/register"} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#a8525c]">{isLoggedIn ? 'Go to Dashboard' : 'View profiles'} <ArrowRight className="h-4 w-4" /></Link></div>
        </div>
      </section>

      <section className="border-t border-[#eaded8] bg-[#fbf4f0] px-6 py-16 text-center sm:px-10"><h2 className="font-display text-3xl font-light tracking-[-.04em]">Your next chapter can start today.</h2><Link href={isLoggedIn ? "/dashboard" : "/register"} className="mt-7 inline-flex items-center gap-2 bg-[#a8525c] px-6 py-3 text-xs font-bold uppercase tracking-[.14em] text-white transition hover:bg-[#7d3a44]">{isLoggedIn ? 'Go to Dashboard' : 'Create a free profile'} <ArrowRight className="h-4 w-4" /></Link></section>
    </div>
  );
}
