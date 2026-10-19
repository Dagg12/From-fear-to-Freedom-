'use client';

import { FormEvent, useState } from 'react';
import { Mail } from 'lucide-react';

export function ContactForm() {
  const [message, setMessage] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const subject = encodeURIComponent(`${data.get('topic')} enquiry from ${data.get('name')}`);
    const body = encodeURIComponent(`Name: ${data.get('name')}\nEmail: ${data.get('email')}\n\n${data.get('message')}`);
    window.location.href = `mailto:refilwe@refilwemogale.co.za?subject=${subject}&body=${body}`;
    setMessage('Your email app should open with this enquiry. The website has not sent or stored it.');
  }
  return <form onSubmit={submit} className="surface grid gap-4 p-6 sm:p-8">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-bold">Your name<input required maxLength={120} name="name" className="field mt-2" placeholder="Full name"/></label>
      <label className="text-xs font-bold">Email address<input required type="email" maxLength={254} name="email" className="field mt-2" placeholder="you@example.com"/></label>
    </div>
    <label className="text-xs font-bold">What would you like to discuss?<select name="topic" className="field mt-2"><option>General enquiry</option><option>Speaking engagement</option><option>Book order</option><option>Media interview</option><option>Partnership or collaboration</option></select></label>
    <label className="text-xs font-bold">Message<textarea required maxLength={5000} name="message" className="field mt-2 min-h-32" placeholder="Tell us a little about your enquiry…"/></label>
    <button className="btn btn-primary">Open email to send enquiry <Mail size={15}/></button>
    {message && <p role="status" className="rounded-lg bg-[#f5ede2] p-3 text-xs leading-5 text-[#694a41]">{message}</p>}
  </form>;
}
