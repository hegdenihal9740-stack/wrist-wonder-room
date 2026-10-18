import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import steel from '@/assets/watch-steel.jpg';

export function AccountLayout({ title, children }: { title: string; children: ReactNode }) {
  return <main className="min-h-screen bg-background text-foreground font-sans">
    <header className="border-b border-border px-5 py-5"><Button asChild variant="ghost"><Link to="/collection" onClick={(e) => { if ((window.history.state?.__TSR_index ?? 0) > 0) { e.preventDefault(); window.history.back(); } }}><ArrowLeft />Back</Link></Button></header>
    <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 md:grid-cols-2 md:py-20">
      <div className="hidden md:block"><img src={steel} alt="Private Flight brushed steel watch" className="aspect-square w-full rounded-md object-cover" /></div>
      <section className="mx-auto w-full max-w-md"><p className="mb-3 text-sm text-muted-foreground">PRIVATE FLIGHT · CUSTOMER ACCOUNT</p><h1 className="mb-8 font-sans text-3xl font-semibold">{title}</h1>{children}</section>
    </div>
  </main>;
}