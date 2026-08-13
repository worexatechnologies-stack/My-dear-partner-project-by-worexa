import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Heart, ShieldCheck, Quote, Users, Star, MessageCircle, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Success Stories | MyDearPartner',
  description: 'Every forever has a first hello. Read real success stories of couples who found love and commitment on MyDearPartner.',
  alternates: { canonical: '/success-stories' },
};

const featuredStories = [
  {
    names: 'Ayesha & Imran',
    quote: "Every step of this journey felt guided, not rushed. MyDearPartner gave us the space to connect naturally, and today we're building a life we both dreamed of.",
    details: 'Married in 2025 • Bengaluru',
    image: '/images/success_story_1.png',
  },
  {
    names: 'Sneha & Arjun',
    quote: "“Our first conversation felt comfortable and genuine. There was no pressure, just two people getting to know each other with honesty and respect. MyDearPartner gave us the confidence to take the first step.”",
    details: 'Married in 2024 • Hyderabad',
    image: '/images/about-couple-hero.webp',
  },
  {
    names: 'Fatima & Sameer',
    quote: "“Finding the right person isn’t about meeting many people; it’s about meeting the right one. Through MyDearPartner, we found not just compatibility but friendship, understanding, and a future we now share.”",
    details: 'Married in 2025 • Chennai',
    image: '/images/success_story_2.png',
  },
];

const stats = [
  { value: '10,000+', label: 'Happy Members' },
  { value: '5,000+', label: 'Meaningful Matches' },
  { value: '200+', label: 'Communities Connected' },
  { value: '4.9★', label: 'Member Satisfaction' },
];

export default function SuccessStoriesPage() {
  return (
    <main className="overflow-hidden text-[#2c2928]">
      {/* Hero Section */}
      <section className="relative isolate overflow-hidden bg-[#f4eee8] px-5 pt-24 pb-20 sm:px-8 lg:pt-28 lg:pb-28">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_10%_20%,rgba(185,207,174,.48),transparent_28rem),radial-gradient(circle_at_88%_8%,rgba(255,255,255,.82),transparent_26rem)]" />
        <div className="absolute left-1/2 top-4 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-rose-200/30 blur-3xl" />

        <div className="mx-auto max-w-5xl text-center">
          <h1 className="font-display text-4xl font-light leading-[1.05] tracking-[-.05em] text-[#2c2928] sm:text-5xl lg:text-6xl">
            Every Match Has a Story. <em className="font-serif font-normal text-[#bd6970]">Every Story Begins with Hope.</em>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl font-medium text-[#8e3d58] italic leading-relaxed">
            “Every forever has a first hello. Let yours begin with MyDearPartner.”
          </p>

          <p className="mx-auto mt-6 max-w-3xl text-base sm:text-lg leading-8 text-slate-700">
            Behind every successful relationship is a journey of trust, patience, and meaningful connection. At MyDearPartner, we’re honoured to have played a small role in bringing together couples who have found love, companionship, and a lifetime of happiness.
          </p>

          <p className="mt-4 font-semibold text-[#20111a] text-lg">
            Their stories remind us that the right person is worth waiting for.
          </p>
        </div>
      </section>

      {/* Real Connections intro */}
      <section className="bg-white px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b64a68]">Real Beginnings</p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-.04em] text-[#20111a] sm:text-4xl">
            Real People. Real Connections. Real Beginnings.
          </h2>
          <p className="mt-5 text-base sm:text-lg leading-8 text-slate-600">
            Every couple has a unique journey, but they all share one thing in common: a meaningful connection that started with a simple introduction. These stories celebrate the moments that turned conversations into commitments &amp; introductions into lifelong togetherness.
          </p>
        </div>
      </section>

      {/* Featured Stories */}
      <section className="bg-[#fffaf7] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b64a68]">Couples We Celebrate</p>
            <h2 className="mt-3 font-display text-3xl font-black tracking-[-.04em] text-[#20111a] sm:text-4xl lg:text-5xl">
              Featured Stories
            </h2>
          </div>

          <div className="grid gap-10 lg:grid-cols-3">
            {featuredStories.map((story) => (
              <article key={story.names} className="group flex flex-col justify-between overflow-hidden rounded-[2.5rem] border border-[#3b1425]/10 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div>
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2rem]">
                    <Image
                      src={story.image}
                      alt={story.names}
                      width={600}
                      height={450}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-5 right-5 text-white">
                      <p className="font-display text-2xl font-black">{story.names}</p>
                      <p className="text-xs font-bold text-rose-200">{story.details}</p>
                    </div>
                  </div>

                  <div className="p-6">
                    <Quote className="h-8 w-8 text-[#8e3d58]/20" />
                    <p className="mt-2 text-base leading-7 text-slate-700 italic">
                      {story.quote}
                    </p>
                  </div>
                </div>

                <div className="px-6 pb-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#b64a68] border-t border-slate-100 pt-4">
                    <ShieldCheck className="h-4 w-4" /> Verified Success Story
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Why Their Stories Matter & Building Futures */}
      <section className="bg-white px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
          {/* Why Their Stories Matter */}
          <div className="rounded-[2.5rem] border border-[#3b1425]/10 bg-[#fffaf7] p-8 sm:p-10 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b64a68]">Core Inspiration</p>
              <h2 className="mt-3 font-display text-3xl font-black tracking-[-.04em] text-[#20111a]">
                Why Their Stories Matter
              </h2>
              <p className="mt-5 text-base sm:text-lg leading-8 text-slate-600">
                Every successful relationship is built on trust, shared values, and genuine conversations. These experiences inspire us to continue creating a platform where meaningful relationships can grow with confidence and respect.
              </p>
            </div>
            <div className="mt-8 rounded-2xl bg-white p-5 border border-rose-100 flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-100 text-[#b64a68]">
                <Heart className="h-6 w-6 fill-current" />
              </div>
              <p className="text-xs font-bold text-slate-700">
                Built on trust, transparency, and mutual respect for a lifelong journey.
              </p>
            </div>
          </div>

          {/* Building Futures, One Story at a Time */}
          <div className="rounded-[2.5rem] border border-[#3b1425]/10 bg-[#fffaf7] p-8 sm:p-10 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b64a68]">Our Purpose</p>
              <h2 className="mt-3 font-display text-3xl font-black tracking-[-.04em] text-[#20111a]">
                Building Futures, One Story at a Time
              </h2>
              <p className="mt-5 text-base sm:text-lg leading-8 text-slate-600">
                Every message exchanged, every family introduced, and every promise made is a reminder of why we do what we do. We are dedicated to helping more people form lasting, meaningful relationships.
              </p>
            </div>
            <div className="mt-8 rounded-2xl bg-white p-5 border border-rose-100 flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-100 text-[#b64a68]">
                <Users className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-slate-700">
                Connecting hearts and bringing families together thoughtfully.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Share Your Journey */}
      <section className="bg-[#20111a] px-5 py-20 text-white sm:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-rose-300">Share Your Journey</p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-.04em] sm:text-4xl lg:text-5xl">
            Your Story Could Inspire Someone Else.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg leading-8 text-slate-300">
            If you found your life partner through MyDearPartner, we’d love to hear your journey. Your experience may give hope and confidence to someone beginning their own search.
          </p>
          <div className="mt-8">
            <Link
              href="/contact"
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#8e3d58] px-8 text-sm font-extrabold text-white shadow-lg transition hover:bg-[#a64a69]"
            >
              Share Your Story <MessageCircle className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Optional Statistics Section */}
      <section className="bg-white px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200/80 bg-[#fffaf7] p-8 text-center shadow-sm">
                <p className="font-display text-4xl font-black text-[#8e3d58]">{stat.value}</p>
                <p className="mt-2 text-sm font-extrabold text-slate-700">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing Section */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#8e3d58] to-[#b64a68] px-7 py-14 text-center text-white shadow-[0_24px_60px_rgba(142,61,88,.22)] sm:px-12">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-black tracking-[-.04em] sm:text-4xl lg:text-5xl">
            Your Forever Story Could Be Next.
          </h2>
          <div className="mx-auto mt-6 max-w-xl space-y-2 text-base sm:text-lg leading-7 text-rose-100">
            <p>Thousands begin their search with hope. Every day, new conversations become lasting relationships.</p>
            <p>Create your profile today and take the first step toward writing your own success story.</p>
          </div>
          <div className="mt-8">
            <Link href="/register" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-8 text-sm font-extrabold text-[#8e3d58] transition hover:-translate-y-0.5 hover:shadow-xl">
              Start Your Journey <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
