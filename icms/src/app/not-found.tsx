import Link from "next/link";

// Global 404 for routes outside the authenticated shell.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-elms-navy p-6 text-center text-white">
      <div className="text-5xl font-bold text-elms-teal">404</div>
      <p className="mt-2 text-white/80">This page could not be found.</p>
      <Link href="/" className="mt-4 rounded-md bg-elms-teal px-4 py-2 text-sm font-medium text-white hover:bg-elms-teal/90">
        Go to ICMS
      </Link>
    </div>
  );
}
