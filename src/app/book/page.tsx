import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, ShieldCheck } from 'lucide-react';
import { AddToCart, BookPrice } from '@/components/book-catalogue';
import { WishlistButton } from '@/components/wishlist-button';

export default function Book() {
  return <>
    <section className="container grid items-center gap-12 py-12 sm:py-20 lg:grid-cols-[.92fr_1.08fr]">
      <div className="relative mx-auto max-w-[620px]">
        <div className="absolute -inset-5 rounded-[48%] bg-[#efe4d5]"/>
        <Image src="/images/BookCover.jpeg" alt="Original full cover artwork for From Fear to Freedom by Refilwe Mokgosi-Mogale" width={1900} height={1333} priority className="relative w-full rounded-sm shadow-2xl"/>
        <p className="relative mt-4 text-center text-[10px] uppercase tracking-[.18em] text-[#86776c]">Original cover artwork supplied by the author</p>
      </div>
      <div>
        <p className="eyebrow">The memoir</p>
        <h1 className="heading mt-4">From Fear <i>to Freedom</i></h1>
        <p className="font-display mt-3 text-2xl italic leading-snug text-[#745b54]">My Eight-Year Ironman Journey and the Voice I Found Along the Way</p>
        <p className="mt-5 text-xs uppercase tracking-[.16em] text-[#9b8056]">By Refilwe Mokgosi-Mogale</p>
        <p className="body-copy mt-6">What happens when a dream takes eight years, when determination meets disappointment, and when a journey that began with a finish line reveals a much bigger story? This memoir explores the courage to keep showing up, the grace to begin again, and the voice we can discover along the way.</p>
        <div className="mt-7"><BookPrice/></div>
        <div className="mt-5 flex flex-wrap gap-3"><AddToCart/><WishlistButton/></div>
        <div className="mt-7 grid gap-3 border-t border-[#e9dfd3] pt-5 sm:grid-cols-2">
          <div className="flex gap-3"><BookOpen size={18} className="mt-1 shrink-0 text-[#b99a62]"/><div><p className="text-xs font-bold">A story beyond sport</p><p className="mt-1 text-xs leading-5 text-[#766b67]">Leadership, faith, family, self-belief and transformation.</p></div></div>
          <div className="flex gap-3"><ShieldCheck size={18} className="mt-1 shrink-0 text-[#b99a62]"/><div><p className="text-xs font-bold">Pre-order or buy securely</p><p className="mt-1 text-xs leading-5 text-[#766b67]">Live price and availability come from the store catalogue.</p></div></div>
        </div>
      </div>
    </section>
    <section className="bg-white"><div className="container grid gap-10 py-14 sm:py-20 md:grid-cols-[.7fr_1.3fr]">
      <div><p className="eyebrow">Inside the journey</p><h2 className="font-display mt-3 text-4xl text-[#581d2b]">A dream. A detour. A deeper discovery.</h2></div>
      <div className="space-y-5"><p className="body-copy">The Ironman pursuit matters, but it is not the only story. Alongside swimming, cycling and running are the quieter milestones: learning to speak up, taking on new professional challenges, accepting mentorship, leading with inclusion and finding steadiness when life does not follow the plan.</p><p className="body-copy">Refilwe’s experience in Tallinn — a race attempt that ended during the swim and was followed by hospital treatment — became a turning point. In the stillness that followed, she began gathering a story that had grown far beyond a sporting result.</p><blockquote className="border-l-2 border-[#b99a62] py-2 pl-5 font-display text-2xl italic leading-snug text-[#581d2b]">“You do not have to begin fearless or confident. You can begin willing.”</blockquote><p className="body-copy">The invitation is simple: do not let fear make every decision for you. Start where you are, learn as you go, and allow the journey to change you.</p></div>
    </div></section>
    <section className="container section-space"><div className="grid gap-10 md:grid-cols-3">{[['Who may connect with it','Readers navigating change, self-doubt or a new chapter.'],['What it explores','Courage, setbacks, faith, endurance, leadership and voice.'],['What it invites','A willingness to begin before confidence arrives.']].map(([title, description])=><div key={title} className="surface p-6"><p className="eyebrow">{title}</p><p className="mt-3 text-sm leading-7 text-[#6e605d]">{description}</p></div>)}</div>
      <div className="mt-10 flex flex-col items-start justify-between gap-5 rounded-2xl bg-[#32131d] p-7 text-white sm:flex-row sm:items-center sm:p-10"><div><p className="eyebrow !text-[#c6a56d]">Ready to turn the page?</p><h2 className="font-display mt-2 text-3xl sm:text-4xl">Begin with the story.</h2></div><div className="flex gap-3"><AddToCart/><Link href="/shop" className="btn border border-white/25 text-white">Browse books <ArrowRight size={16}/></Link></div></div>
    </section>
  </>;
}
