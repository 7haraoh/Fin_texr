import { navigate, useRoute } from "../router";

export function useRouter() {
  return { refresh() {}, push: navigate, replace: navigate, back() { history.back(); } };
}
export function usePathname() {
  const { view } = useRoute();
  return `/${view}`;
}
export function redirect(href: string): never {
  navigate(href);
  throw new Error("redirect");
}
