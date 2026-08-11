import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Heart, ShieldCheck } from 'lucide-react';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Success Stories',
  description: 'Read how meaningful connections begin with trust, compatibility, and mutual intent.',
  alternates: { canonical: '/success-stories' },
};

const stories = [
  {
    title: 'A thoughtful introduction',
    body: 'A shared focus on values and open conversations helped two members take their first steps with confidence.',
    image: '/images/success_story_1.png',
  },
  {
    title: 'Families, together',
    body: 'With clear preferences and respectful communication, an introduction grew into a connection both families could celebrate.',
    image: '/images/wedding-rings.jpg',
  },
  {
    title: 'The right pace',
    body: 'Taking time to understand each other made it easier to turn compatibility into a meaningful commitment.',
    image: '/images/success_story_2.png',
  },
];

export default function SuccessStoriesPage() {
  return (
    <main className="overflow-hidden bg-[#fffefd] pt-20 text-[#2c2928]">
      <section className="relative overflow-hidden bg-[#f4eee8] px-6 py-20 sm:px-10 lg:px-14 lg:py-28"><div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_30%,rgba(185,207,174,.5),transparent_25%),radial-gradient(circle_at_91%_7%,rgba(255,255,255,.85),transparent_25%)]" /><div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[.9fr_1.1fr]"><div><p className="font-display text-[10px] font-bold uppercase tracking-[.32em] text-[#bd6970]">Real stories, real beginnings</p><h1 className="mt-5 max-w-lg font-display text-5xl font-light leading-[.93] tracking-[-.06em] sm:text-6xl">Love grows from a <em className="font-serif font-normal text-[#bd6970]">simple hello.</em></h1><p className="mt-6 max-w-md leading-7 text-stone-600">Every relationship is unique. Here are a few of the thoughtful beginnings that grew into something more.</p></div><div className="grid h-[300px] grid-cols-3 grid-rows-2 gap-2 sm:h-[370px]"><Image src="/images/hero_background.webp" alt="Celebration setting" width={600} height={600} className="col-span-2 row-span-2 h-full w-full object-cover" priority /><Image src="/images/about-couple-hero.webp" alt="Couple portrait" width={300} height={300} className="h-full w-full object-cover" /><Image src="/images/wedding-rings.jpg" alt="Wedding rings" width={300} height={300} className="h-full w-full object-cover" /></div></div></section>
      <section className="mx-auto grid max-w-6xl gap-7 px-6 py-20 sm:px-10 md:grid-cols-3 lg:px-14 lg:py-28">
        {stories.map((story) => (
          <article key={story.title} className="group overflow-hidden border border-[#eaded8] bg-white transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(64,52,43,.12)]"><Image src={story.image} alt="" width={600} height={420} className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" /><div className="p-7"><ShieldCheck className="h-5 w-5 text-[#bd6970]" aria-hidden="true" /><h2 className="mt-5 font-display text-2xl font-light">{story.title}</h2><p className="mt-3 leading-7 text-stone-600">{story.body}</p></div>
          </article>
        ))}
      </section>
      <section className="bg-[#f25d61] px-6 py-16 text-center text-white sm:px-10"><Heart className="mx-auto h-6 w-6 fill-current" /><h2 className="mt-4 font-display text-3xl font-light">Your story deserves a thoughtful start.</h2><p className="mx-auto mt-3 max-w-xl text-white/85">Create a profile and explore introductions designed around your preferences and privacy.</p><Link href="/register" className="mt-7 inline-flex items-center gap-2 border border-white bg-white px-5 py-3 text-xs font-bold uppercase tracking-[.13em] text-[#b14e57] transition hover:bg-transparent hover:text-white">Create a free profile <ArrowRight className="h-4 w-4" /></Link></section>
    </main>
  );
}
