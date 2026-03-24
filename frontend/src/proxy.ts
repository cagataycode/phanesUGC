import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: [
    '/',                    // Match root
    '/(de|en)/:path*',      // Match locale paths
    '/((?!api|_next|_vercel|.*\\..*).*)'  // Match all except excluded
  ]
};
