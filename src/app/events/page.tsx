import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, Mic2 } from 'lucide-react';
import { EventList } from '@/components/event-list';

export default function Events() {
  return <>
    <section className="container grid items-center gap-10 py-12 sm:py-18 md:grid-cols-[1fr_.8fr]">
      <div><p className="eyebrow">Events & appearances</p><h1 className="heading mt-4">Meet us where <i>stories happen.</i></h1><p className="body-copy mt-5">Book conversations, speaking engagements, professional events and community gatherings are opportunities to explore courage, leadership, resilience and the freedom to find your voice.</p><Link href="/contact" className="btn btn-primary mt-7">Invite Refilwe to an event <ArrowUpRight size={16}/></Link></div>
      <Image src="/images/author-event.webp" alt="Refilwe at an event" width={960} height={969} className="h-[340px] w-full rounded-xl object-cover sm:h-[430px]"/>
    </section>
    <section className="bg-white"><div className="container py-14 sm:py-18">
      <p className="eyebrow">Event calendar</p><h2 className="font-display mt-3 text-4xl text-[#581d2b]">Upcoming appearances</h2><EventList/>
    </div></section>
    <section className="container section-space"><div className="grid gap-6 md:grid-cols-3">{[['Book conversations','Small groups, readers’ circles and moderated discussions.'],['Professional speaking','Engineering, leadership, inclusion and personal development.'],['Community engagements','Encouraging conversations with young people and community audiences.']].map(([title, description])=><div key={title} className="surface p-6"><Mic2 size={22} className="text-[#b99a62]"/><h3 className="font-display mt-4 text-2xl text-[#581d2b]">{title}</h3><p className="body-copy mt-2 text-sm">{description}</p></div>)}</div></section>
  </>;
}
