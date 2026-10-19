'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { createClient, hasSupabaseConfig } from '@/lib';

type PublicEvent = {
  slug: string;
  title: string;
  summary: string | null;
  starts_at: string;
  timezone: string;
  location_name: string | null;
  booking_url: string | null;
};

export function EventList() {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [message, setMessage] = useState('Loading event calendar…');
  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setMessage('The event calendar is unavailable until Supabase is configured.');
      return;
    }
    let alive = true;
    void Promise.resolve(createClient().from('events').select('slug,title,summary,starts_at,timezone,location_name,booking_url')
      .eq('status', 'published').gte('starts_at', new Date().toISOString()).order('starts_at')
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setMessage('Unable to load the event calendar.');
        else {
          setEvents((data ?? []) as PublicEvent[]);
          setMessage(data?.length ? '' : 'No public event dates have been confirmed yet.');
        }
      }))
      .catch(() => { if (alive) setMessage('Unable to load the event calendar.'); });
    return () => { alive = false; };
  }, []);
  return <div className="mt-8">
    {message && <p role="status" className="rounded-2xl border border-dashed border-[#d9c9b7] bg-[#fbf7f0] p-8 text-center text-sm text-[#766b67]">{message}</p>}
    <div className="grid gap-4 md:grid-cols-2">{events.map((event) => <article key={event.slug} className="surface p-6">
      <CalendarDays size={22} className="text-[#b99a62]"/>
      <p className="eyebrow mt-4">{new Date(event.starts_at).toLocaleString('en-ZA', { timeZone: event.timezone, dateStyle: 'long', timeStyle: 'short' })}</p>
      <h3 className="font-display mt-2 text-2xl text-[#581d2b]">{event.title}</h3>
      {event.summary && <p className="body-copy mt-2 text-sm">{event.summary}</p>}
      <p className="mt-2 text-xs text-[#766b67]">{event.location_name || 'Location to be confirmed'}</p>
      {event.booking_url ? <a href={event.booking_url} target="_blank" rel="noreferrer" className="btn btn-primary mt-5">Event details and booking</a> :
        <Link href={`/events/${encodeURIComponent(event.slug)}`} className="btn btn-outline mt-5">Event details</Link>}
    </article>)}</div>
  </div>;
}
