import { createFileRoute } from '@tanstack/react-router';
import { AmazonWatchCards } from '@/components/AmazonWatchCards';
import { ShopHeader } from '@/components/ShopHeader';

export const Route = createFileRoute('/collection')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'Shop the Collection — Private Flight Store' },
      { name: 'description', content: 'Browse every Private Flight watch: steel, black, gold and rose gold — with prices, ratings and delivery.' },
      { property: 'og:title', content: 'Shop the Collection — Private Flight Store' },
      { property: 'og:description', content: 'Browse every Private Flight watch: steel, black, gold and rose gold — with prices, ratings and delivery.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: CollectionPage,
});

function CollectionPage() {
  return <main className="shop-page">
    <ShopHeader />
    <AmazonWatchCards />
  </main>;
}
