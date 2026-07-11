// Static fallback the service worker serves for navigations that miss the
// network (see public/sw.js). Must not fetch anything itself.
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold text-blue-600">TaskApp</h1>
        <p className="mt-4 text-gray-700">You&apos;re offline</p>
        <p className="mt-2 text-sm text-gray-500">
          Check your connection and try again. Any page you&apos;ve already visited may still be
          available.
        </p>
      </div>
    </div>
  );
}
