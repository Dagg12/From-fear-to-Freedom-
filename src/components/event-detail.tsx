'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { createClient, hasSupabaseConfig } from '@/lib';

type PublicEvent = {
  title: string;
  summary: string | null;
  description: string;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  location_name: string | null;
  address: string | null;
  booking_url: string | null;
};

export function EventDetail({ slug }: { slug: string }) {
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [message, setMessage] = useState('Loading event…');
  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setMessage('Event details are unavailable until Supabase is configured.');
      return;
    }
    let alive = true;
    void Promise.resolve(createClient().from('events').select('title,summary,description,starts_at,ends_at,timezone,location_name,address,booking_url')
      .eq('slug', slug).eq('status', 'published').maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setMessage('Unable to load event details.');
        else if (!data) setMessage('This event is not available or has not been published.');
        else {
          setEvent(data as PublicEvent);
          setMessage('');
        }
      }))
      .catch(() => { if (alive) setMessage('Unable to load event details.'); });
    return () => { alive = false; };
  }, [slug]);
  if (!event) return <div className="container section-space max-w-3xl"><Link href="/events" className="text-xs font-bold underline">← All events</Link><p role="status" className="surface mt-6 p-7 text-sm">{message}</p></div>;
  const dateOptions: Intl.DateTimeFormatOptions = { timeZone: event.timezone, dateStyle: 'long', timeStyle: 'short' };
  return <div className="container section-space max-w-3xl">
    <Link href="/events" className="text-xs font-bold underline">← All events</Link>
    <article className="surface mt-6 p-7 sm:p-10">
      <CalendarDays size={28} className="text-[#b99a62]"/>
      <p className="eyebrow mt-5">{new Date(event.starts_at).toLocaleString('en-ZA', dateOptions)}{event.ends_at ? ` – ${new Date(event.ends_at).toLocaleTimeString('en-ZA', { timeZone: event.timezone, timeStyle: 'short' })}` : ''}</p>
      <h1 className="heading mt-3">{event.title}</h1>
      {event.summary && <p className="font-display mt-4 text-xl italic text-[#745b54]">{event.summary}</p>}
      {event.location_name && <p className="mt-5 text-sm font-semibold">{event.location_name}</p>}
      {event.address && <p className="mt-1 text-sm text-[#766b67]">{event.address}</p>}
      <p className="body-copy mt-6 whitespace-pre-line">{event.description}</p>
      {event.booking_url && <a href={event.booking_url} target="_blank" rel="noreferrer" className="btn btn-primary mt-6">Booking and event information</a>}
    </article>
  </div>;
}
