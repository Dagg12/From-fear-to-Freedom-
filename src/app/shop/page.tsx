import { BookCatalogue } from '@/components/book-catalogue';

export default function Shop() {
  return <div className="container section-space">
    <p className="eyebrow">The author’s bookstore</p>
    <h1 className="heading mt-3">Stories for the <i>next chapter.</i></h1>
    <p className="body-copy mt-5 max-w-2xl">Browse available books and pre-orders. Prices and availability are managed by the store and shown from the live catalogue.</p>
    <BookCatalogue />
  </div>;
}
