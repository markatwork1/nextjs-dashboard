import SideNav from '@/app/ui/dashboard/sidenav';
import jwt from 'jsonwebtoken';
import { headers } from 'next/headers';
import { Metadata } from 'next';
 
export const metadata: Metadata = {
  title: {
    template: '%s | Acme Dashboard',
    default: 'Acme Dashboard',
  },
  description: 'The official Next.js Learn Dashboard built with App Router.',
  metadataBase: new URL('https://next-learn-dashboard.vercel.sh'),
};

// Ensure this layout is rendered per-request so cookies/headers are available
export const dynamic = 'force-dynamic';

const SECRET = process.env.AUTH_SECRET || 'dev_secret_key';

export default async function Layout({ children }: { children: React.ReactNode }) {
  // Read raw cookie header and verify token directly to avoid context issues
  const cookieHeader = (await headers()).get('cookie') || '';
  // match the auth_token cookie and capture everything until the next semicolon
  const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
  const token = match ? match[1] : null;
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('[layout] cookieHeader length', cookieHeader.length, 'found token?', !!token);
  }
  let user = null;
  if (token) {
    try {
      user = jwt.verify(token, SECRET) as any;
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[layout] verified user', user?.email);
      }
    } catch (err) {
      // invalid token -> treat as unauthenticated
      user = null;
    }
  }

  if (!user) {
    return Response.redirect(`/login?callbackUrl=${encodeURIComponent('/dashboard')}`);
  }
  return (
    <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
      <div className="w-full flex-none md:w-64">
        <SideNav />
      </div>
      <div className="flex-grow p-6 md:overflow-y-auto md:p-12">{children}</div>
    </div>
  );
}