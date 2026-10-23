'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';

function readCount() {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('fff-cart') ?? '[]');
    if (!Array.isArray(saved)) return 0;
    return saved.reduce((total, item) => {
      if (!item || typeof item !== 'object') return total;
      const qty = Number((item as { qty?: unknown }).qty);
      return total + (Number.isInteger(qty) && qty > 0 ? qty : 0);
    }, 0);
  } catch { return 0; }
}

export function BagLink() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => setCount(readCount());
    refresh();
    window.addEventListener('fff-cart-update', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('fff-cart-update', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return <Link href="/cart" aria-label={count ? `Bag, ${count} item${count === 1 ? '' : 's'}` : 'Bag'} className="btn btn-primary !px-4 !py-2.5">
    <span className="relative inline-flex"><ShoppingBag size={15}/>{count > 0 && <span className="absolute -right-3 -top-3 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#fbf7f0] bg-[#c6a56d] px-1 text-[10px] font-bold leading-none text-[#32131d]">{count > 99 ? '99+' : count}</span>}</span>
    <span className="hidden sm:inline">Bag</span>
  </Link>;
}
