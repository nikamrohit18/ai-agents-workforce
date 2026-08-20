import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          AI Agents Workforce
        </Link>
        <UserButton />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
