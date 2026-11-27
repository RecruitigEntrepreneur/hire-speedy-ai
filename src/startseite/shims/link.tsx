// Ersatz für next/link: ein gewöhnlicher Link (die Seite verlässt beim Klick ohnehin die Website).
import type { AnchorHTMLAttributes, ReactNode } from 'react';
export default function Link({ href, children, prefetch: _p, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode; prefetch?: boolean }) {
  return <a href={href} {...rest}>{children}</a>;
}
