import { navigate } from "../router";

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean };

export default function Link({ href, onClick, prefetch: _p, children, ...rest }: Props) {
  const view = href.replace(/^\/+/, "").split(/[?#/]/)[0];
  return (
    <a {...rest} href={view ? `#${view}` : "#"} onClick={(e) => { e.preventDefault(); onClick?.(e); navigate(href); }}>
      {children}
    </a>
  );
}
