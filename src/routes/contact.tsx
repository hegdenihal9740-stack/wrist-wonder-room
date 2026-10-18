import { createFileRoute } from '@tanstack/react-router';
import { PolicyPage, meta } from '@/components/PolicyPage';
import { STORE_CONTACT } from '@/lib/store-info';

export const Route = createFileRoute('/contact')({
  head: () => meta('Contact & Support — Private Flight Store', 'Reach Private Flight support by phone, WhatsApp or email.'),
  component: () => <PolicyPage title="Contact us">
    <p>We are happy to help with orders, delivery and returns.</p>
    <h3>Phone / WhatsApp</h3><p><a href={`tel:${STORE_CONTACT.phone}`}>{STORE_CONTACT.phone}</a> · <a href={`https://wa.me/${STORE_CONTACT.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Chat on WhatsApp</a></p>
    <h3>Email</h3><p><a href={`mailto:${STORE_CONTACT.email}`}>{STORE_CONTACT.email}</a></p>
    <h3>Hours</h3><p>{STORE_CONTACT.hours}</p>
    <h3>Address</h3><p>{STORE_CONTACT.address}</p>
  </PolicyPage>,
});
