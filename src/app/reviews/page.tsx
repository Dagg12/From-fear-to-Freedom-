import { Star, Quote } from 'lucide-react';
import { ReviewForm } from '@/components/review-form';
import { ApprovedReviews } from '@/components/approved-reviews';

export default function Reviews() {
  return <div className="container section-space">
    <p className="eyebrow">Reader reflections</p><h1 className="heading mt-3">Every story leaves <i>a trace.</i></h1>
    <p className="body-copy mt-5 max-w-2xl">The most meaningful part of sharing a story is discovering what it awakens in someone else. Reviews are shown after moderation.</p>
    <div className="mt-9 grid gap-8 lg:grid-cols-[1fr_.9fr]">
      <div className="rounded-2xl bg-[#32131d] p-7 text-white sm:p-10"><Quote size={28} className="text-[#c6a56d]"/><h2 className="font-display mt-5 text-3xl">Your perspective matters.</h2><p className="mt-3 text-sm leading-7 text-white/70">If you have read From Fear to Freedom, share a thoughtful reflection about the themes, moments or lessons that stayed with you.</p><div className="mt-6 flex gap-1 text-[#c6a56d]">{[1, 2, 3, 4, 5].map((number) => <Star key={number} size={17} fill="currentColor"/>)}</div><p className="mt-2 text-[10px] uppercase tracking-[.16em] text-white/50">Reader reviews are moderated</p></div>
      <ReviewForm/>
    </div>
    <ApprovedReviews/>
  </div>;
}
