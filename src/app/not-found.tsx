import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-oasis-black flex flex-col items-center justify-center px-6 text-center">
      {/* 404 display */}
      <div className="mb-6">
        <h1 className="text-7xl font-heading text-oasis-green mb-2">404</h1>
        <div className="w-24 h-1 bg-oasis-green/30 rounded-full mx-auto" />
      </div>

      {/* Message */}
      <h2 className="text-2xl font-semibold text-oasis-text mb-3">
        Page not found
      </h2>
      <p className="text-oasis-muted max-w-sm mb-8">
        The page you are looking for does not exist or has been moved. Let us get
        you back to scanning products.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="px-6 py-3 bg-oasis-green text-oasis-black font-semibold rounded-xl hover:bg-oasis-green-dim transition-colors"
        >
          Go Home
        </Link>
        <Link
          href="/search"
          className="px-6 py-3 bg-oasis-card border border-oasis-border text-oasis-text font-semibold rounded-xl hover:bg-oasis-card-hover transition-colors"
        >
          Search Products
        </Link>
      </div>
    </div>
  );
}
