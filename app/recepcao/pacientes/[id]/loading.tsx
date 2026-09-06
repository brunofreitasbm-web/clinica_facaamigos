import React from "react";

export default function PatientPageLoading() {
  return (
    <main className="flex flex-1 flex-col animate-fade-in">
      <div className="px-10 pt-6">
        <div className="h-4 w-28 rounded skeleton-shimmer" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-6 px-10 pt-9">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-full skeleton-shimmer" />
          <div className="space-y-2">
            <div className="h-4 w-44 rounded skeleton-shimmer" />
            <div className="h-8 w-64 rounded-lg skeleton-shimmer" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <div className="h-10 w-32 rounded-lg skeleton-shimmer" />
          <div className="h-10 w-48 rounded-lg skeleton-shimmer" />
          <div className="h-10 w-28 rounded-lg skeleton-shimmer" />
        </div>
      </div>

      <div className="px-10 pt-8">
        <div className="card max-w-[900px] space-y-4">
          <div className="h-4 w-32 rounded skeleton-shimmer" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-20 rounded skeleton-shimmer" />
                <div className="h-5 w-28 rounded skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-10 pt-8">
        <div className="card max-w-[900px] space-y-4">
          <div className="h-5 w-40 rounded skeleton-shimmer" />
          <div className="h-32 w-full rounded-lg skeleton-shimmer" />
        </div>
      </div>
    </main>
  );
}
