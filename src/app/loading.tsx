export default function Loading() {
  return (
    <div className="min-h-dvh bg-oasis-black flex flex-col items-center justify-center px-6">
      {/* Logo pulse */}
      <div className="relative mb-8">
        <div className="w-16 h-16 rounded-2xl bg-oasis-green/20 flex items-center justify-center animate-pulse">
          <span className="text-2xl font-heading text-oasis-green">O</span>
        </div>
        <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-oasis-green/10 animate-ping" />
      </div>

      {/* Skeleton cards */}
      <div className="w-full max-w-md space-y-4">
        {/* Title skeleton */}
        <div className="h-8 bg-oasis-card rounded-lg w-3/4 mx-auto animate-pulse" />
        <div className="h-4 bg-oasis-card rounded w-1/2 mx-auto animate-pulse" />

        {/* Card skeletons */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-oasis-card rounded-2xl p-4 border border-oasis-border animate-pulse"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-oasis-border rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-oasis-border rounded w-3/4" />
                <div className="h-3 bg-oasis-border rounded w-1/2" />
              </div>
              <div className="w-10 h-10 bg-oasis-border rounded-full shrink-0" />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-oasis-muted text-sm animate-pulse">Loading...</p>
    </div>
  );
}
