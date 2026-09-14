import { QueryProvider } from "@/providers/QueryProvider";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
            <Link href="/" className="text-lg font-semibold hover:opacity-80 transition-opacity">
              Kanban
            </Link>
            <SignOutButton />
          </div>
        </nav>
        <main>{children}</main>
      </div>
    </QueryProvider>
  );
}
