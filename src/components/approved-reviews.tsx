'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { createClient, hasSupabaseConfig } from '@/lib';

type Review = { id: string; display_name: string; rating: number; title: string | null; body: string; created_at: string };

export function ApprovedReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [message, setMessage] = useState('Loading published reviews…');
  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setMessage('Published reviews are unavailable until the database is configured.');
      return;
    }
    let alive = true;
    void createClient().from('reviews').select('id,display_name,rating,title,body,created_at').eq('status', 'approved').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setMessage('Unable to load published reviews.');
        else {
          setReviews((data ?? []) as Review[]);
          setMessage(data?.length ? '' : 'No published reader reviews yet.');
        }
      });
    return () => { alive = false; };
  }, []);
  return <section className="mt-10">
    {message && <p role="status" className="rounded-xl border border-dashed border-[#d9c9b7] p-6 text-center font-display text-2xl text-[#581d2b]">{message}</p>}
    <div className="grid gap-4 md:grid-cols-2">{reviews.map((review) => <article key={review.id} className="surface p-6">
      <div className="flex gap-1 text-[#b99a62]">{Array.from({ length: review.rating }, (_, index) => <Star key={index} size={15} fill="currentColor"/>)}</div>
      {review.title && <h3 className="mt-3 font-semibold">{review.title}</h3>}
      <p className="mt-3 text-sm leading-6 text-[#5e514d]">{review.body}</p>
      <p className="mt-4 text-xs font-bold text-[#581d2b]">{review.display_name}</p>
    </article>)}</div>
  </section>;
}
