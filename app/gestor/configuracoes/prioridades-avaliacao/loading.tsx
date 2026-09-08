export default function Loading() {
  return (
    <div className="flex-1 p-8">
      <div className="animate-pulse">
        <div className="h-8 w-96 bg-paper-line-strong rounded mb-2" />
        <div className="h-4 w-full max-w-2xl bg-paper-line-strong rounded mb-8" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-paper-line-strong rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
