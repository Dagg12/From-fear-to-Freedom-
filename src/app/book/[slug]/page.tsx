import { BookDetail } from '@/components/book-detail';

export default async function BookBySlug({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BookDetail slug={slug} />;
}
