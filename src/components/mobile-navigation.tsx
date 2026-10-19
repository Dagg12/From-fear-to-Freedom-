'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

type NavigationLink = {
  label: string;
  href: string;
};

export function MobileNavigation({ links }: { links: NavigationLink[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return <div className="lg:hidden">
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls="mobile-site-navigation"
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
      onClick={() => setIsOpen((open) => !open)}
      className="flex items-center gap-2 rounded-full border border-[#cdbfae] px-3 py-2 text-xs font-semibold text-[#581d2b] hover:bg-white"
    >
      {isOpen ? <X size={17}/> : <Menu size={17}/>}
      <span>Menu</span>
    </button>
    {isOpen && <nav id="mobile-site-navigation" className="absolute inset-x-0 top-full border-t border-[#e9dfd3] bg-[#fbf7f0] px-5 py-4 shadow-lg">
      <div className="container grid grid-cols-2 gap-1">
        {links.map(({ label, href }) => <Link
          key={href}
          href={href}
          onClick={() => setIsOpen(false)}
          className="rounded-lg px-3 py-3 text-sm font-semibold text-[#5f5350] hover:bg-white hover:text-[#581d2b]"
        >{label}</Link>)}
      </div>
    </nav>}
  </div>;
}
