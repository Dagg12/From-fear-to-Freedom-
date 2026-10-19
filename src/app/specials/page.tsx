import Link from 'next/link';
import { ArrowRight, Gift } from 'lucide-react';

export default function Specials() {
  return <div className="container section-space">
    <p className="eyebrow">Offers & reader extras</p>
    <h1 className="heading mt-3">A little something <i>extra.</i></h1>
    <p className="body-copy mt-5 max-w-2xl">There are no active promotions at this time. Any future offer will be shown here with its confirmed terms and dates.</p>
    <div className="surface mt-10 max-w-2xl p-7 sm:p-10">
      <Gift className="text-[#b99a62]" size={25}/>
      <p className="eyebrow mt-5">For groups & organisations</p>
      <h2 className="font-display mt-3 text-3xl text-[#581d2b]">Book conversations</h2>
      <p className="body-copy mt-3 text-sm">Planning a book discussion, team event or speaking engagement? Contact the author’s team to discuss your audience and needs.</p>
      <Link href="/contact" className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-[#581d2b]">Make an enquiry <ArrowRight size={15}/></Link>
    </div>
  </div>;
}
