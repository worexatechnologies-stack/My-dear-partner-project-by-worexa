import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, HeartHandshake, LockKeyhole, ShieldCheck, UsersRound } from 'lucide-react';

const principles = [
  { icon: ShieldCheck, title: 'Verified with care', text: 'Thoughtful checks help every introduction begin with more confidence.' },
  { icon: LockKeyhole, title: 'Private by default', text: 'You decide when and with whom to share personal details and photos.' },
  { icon: HeartHandshake, title: 'Built for intention', text: 'A calm space for people who are serious about a meaningful future.' },
];

const steps = [
  ['01', 'Share your story', 'Build a profile that reflects your values, life, and hopes.'],
  ['02', 'Discover thoughtfully', 'Explore compatible profiles at your own pace.'],
  ['03', 'Connect with confidence', 'Take the next step when an introduction feels right.'],
];

export default function AboutPage() {
  return (
    <main className="overflow-hidden bg-[#fffefd] pt-20 text-[#2c2928]">
      <section className="relative isolate overflow-hidden bg-[#f4eee8] px-5 py-20 sm:px-8 lg:py-28">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_10%_20%,rgba(185,207,174,.48),transparent_28rem),radial-gradient(circle_at_88%_8%,rgba(255,255,255,.82),transparent_26rem)]" />
        <div className="absolute left-1/2 top-4 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-rose-200/30 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-20">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#8e3d58]/15 bg-white/70 px-3.5 py-2 text-xs font-extrabold uppercase tracking-[.14em] text-[#8e3d58] shadow-sm"><Image src="/images/main-logo.png" alt="" width={16} height={16} className="h-4 w-4 object-contain" /> About My Dear Partner</p>
            <h1 className="mt-6 font-display text-5xl font-light leading-[.92] tracking-[-.065em] text-[#2c2928] sm:text-6xl lg:text-7xl">A better beginning for <em className="font-serif font-normal text-[#bd6970]">forever.</em></h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">My Dear Partner brings together modern care and timeless values to make meaningful introductions feel more personal, secure, and hopeful.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#8e3d58] px-6 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(142,61,88,.25)] transition hover:-translate-y-0.5 hover:bg-[#702d45]">Create your profile <ArrowRight className="h-4 w-4" /></Link>
              <a href="#our-principles" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#3b1425]/12 bg-white/75 px-6 text-sm font-extrabold text-[#633447] transition hover:bg-white">What we believe</a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-5 gap-y-3 text-sm font-bold text-slate-600"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#b64a68]" /> Privacy-first</span><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#b64a68]" /> Purposeful matching</span><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#b64a68]" /> Family respectful</span></div>
          </div>
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute -inset-5 rounded-[3rem] bg-gradient-to-br from-rose-200/60 to-amber-100/70 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/80 bg-white p-3 shadow-[0_24px_70px_rgba(62,22,39,.16)]">
              <Image src="/images/about-couple-hero.webp" alt="A couple sharing a moment together" width={1122} height={1402} className="aspect-[4/5] w-full rounded-[1.9rem] object-cover" priority />
              <div className="absolute inset-x-3 bottom-3 rounded-b-[1.9rem] bg-gradient-to-t from-[#20111a]/85 via-[#20111a]/20 to-transparent px-6 pb-6 pt-20 text-white"><p className="text-xs font-bold uppercase tracking-[.16em] text-rose-200">Made for real lives</p><p className="mt-2 font-display text-2xl font-extrabold leading-tight">Every story deserves a thoughtful start.</p></div>
            </div>
            <div className="absolute -bottom-6 -left-3 rounded-2xl border border-white bg-white px-4 py-3 shadow-xl sm:-left-8"><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#b64a68]">Our promise</p><p className="mt-1 text-sm font-extrabold text-slate-900">Connection with care</p></div>
          </div>
        </div>
      </section>

      <section id="our-principles" className="bg-white px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl"><div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b64a68]">The My Dear Partner difference</p><h2 className="mt-4 font-display text-4xl font-black tracking-[-.04em] text-[#20111a] sm:text-5xl">Marriage is personal. Your search should feel that way too.</h2></div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">{principles.map(({ icon: Icon, title, text }, index) => <article key={title} className="group rounded-[1.75rem] border border-[#3b1425]/8 bg-[#fffaf7] p-7 transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_20px_45px_rgba(62,22,39,.10)]"><div className="flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-[#b64a68]"><Icon className="h-6 w-6" /></span><span className="font-display text-4xl font-black text-[#8e3d58]/10">0{index + 1}</span></div><h3 className="mt-7 text-xl font-extrabold text-[#20111a]">{title}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p></article>)}</div>
        </div>
      </section>

      <section className="bg-[#fffaf7] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
          <div className="relative overflow-hidden rounded-[2rem] border border-white bg-white p-2 shadow-[0_18px_45px_rgba(62,22,39,.12)]">
            <Image src="/images/about-family-story.webp" alt="Two families meeting warmly in a garden" width={1704} height={960} className="aspect-[16/10] w-full rounded-[1.5rem] object-cover" />
          </div>
          <div className="max-w-xl"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b64a68]">For every kind of beginning</p><h2 className="mt-4 font-display text-4xl font-black tracking-[-.04em] text-[#20111a] sm:text-5xl">Personal choices, with room for family.</h2><p className="mt-5 text-lg leading-8 text-slate-600">Finding a partner is deeply personal, and often beautifully shared. My Dear Partner gives each member control over their journey while making space for the people who matter most.</p><div className="mt-7 grid gap-3 text-sm font-bold text-slate-700"><p className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#b64a68]" /> Share profiles only when you are ready.</p><p className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#b64a68]" /> Build connections around real values and mutual respect.</p></div></div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#20111a] px-5 py-20 text-white sm:px-8 lg:py-28"><div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-rose-500/20 blur-3xl" /><div className="relative mx-auto max-w-7xl"><div className="grid items-start gap-12 lg:grid-cols-[.8fr_1.2fr]"><div><p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.16em] text-rose-300"><Image src="/images/main-logo.png" alt="" width={16} height={16} className="h-4 w-4 object-contain" /> A simpler journey</p><h2 className="mt-5 font-display text-4xl font-black tracking-[-.04em] sm:text-5xl">Less noise. More room for what matters.</h2><p className="mt-5 max-w-md leading-7 text-slate-300">We designed every step to help you move with clarity—not pressure—from a first profile to a meaningful conversation.</p></div><div className="grid gap-4">{steps.map(([number, title, text]) => <div key={number} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[.06] p-5 sm:grid-cols-[3.5rem_1fr] sm:p-6"><span className="font-display text-3xl font-black text-rose-300">{number}</span><div><h3 className="text-lg font-extrabold">{title}</h3><p className="mt-1.5 leading-6 text-sm text-slate-300">{text}</p></div></div>)}</div></div></div></section>

      <section className="px-5 py-20 sm:px-8 lg:py-28"><div className="mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#8e3d58] to-[#b64a68] px-7 py-12 text-center text-white shadow-[0_24px_60px_rgba(142,61,88,.22)] sm:px-12"><UsersRound className="mx-auto h-10 w-10 text-rose-100" /><h2 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-black tracking-[-.04em] sm:text-5xl">Your next chapter can start with one honest hello.</h2><p className="mx-auto mt-5 max-w-xl leading-7 text-rose-100">Create a profile free of charge and take your time finding the connection that feels right.</p><Link href="/register" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-6 text-sm font-extrabold text-[#8e3d58] transition hover:-translate-y-0.5 hover:shadow-xl">Start your journey <ArrowRight className="h-4 w-4" /></Link></div></section>
    </main>
  );
}
