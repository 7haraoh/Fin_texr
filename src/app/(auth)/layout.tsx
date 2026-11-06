import Link from "next/link";
import { PiggyBank } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-fg"><PiggyBank size={20} /></span>
        <span className="text-lg font-semibold tracking-tight">Finance OS</span>
      </Link>
      <div className="card w-full max-w-sm p-6">{children}</div>
      <p className="mt-6 max-w-sm text-center text-xs text-faint">
        Nunca pedimos senhas bancárias. Seus dados são privados e criptografados. <Link href="/privacidade" className="underline">Política de privacidade</Link>
      </p>
    </div>
  );
}
