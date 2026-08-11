'use client';

import React from 'react';

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-pulse flex flex-col space-y-2">
          <div className="h-4 w-20 bg-gray-200 rounded" />
          <div className="h-8 w-12 bg-gray-300 rounded" />
        </div>
      ))}
    </div>
  );
}

export function TicketListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-pulse flex flex-col space-y-3">
          <div className="flex justify-between items-center">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-3 w-16 bg-gray-100 rounded" />
          </div>
          <div className="h-5 w-3/4 bg-gray-300 rounded" />
          <div className="flex gap-2">
            <div className="h-5 w-16 bg-gray-100 rounded-full" />
            <div className="h-5 w-16 bg-gray-100 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConversationSkeleton() {
  return (
    <div className="space-y-4 p-4 flex flex-col h-full justify-end">
      <div className="flex flex-col space-y-2 max-w-[70%] animate-pulse">
        <div className="h-3 w-20 bg-gray-200 rounded" />
        <div className="h-10 bg-gray-200 rounded-2xl rounded-tl-none" />
      </div>
      <div className="flex flex-col space-y-2 max-w-[70%] self-end items-end animate-pulse">
        <div className="h-3 w-20 bg-gray-200 rounded" />
        <div className="h-14 w-60 bg-rose-200 rounded-2xl rounded-tr-none" />
      </div>
      <div className="flex flex-col space-y-2 max-w-[70%] animate-pulse">
        <div className="h-3 w-20 bg-gray-200 rounded" />
        <div className="h-12 w-80 bg-gray-200 rounded-2xl rounded-tl-none" />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="bg-white/80 rounded-3xl border border-gray-100 shadow-xl p-8 max-w-4xl mx-auto animate-pulse space-y-6">
      <div className="flex flex-col md:flex-row gap-8 items-center md:items-start border-b border-gray-100 pb-8">
        <div className="w-32 h-32 rounded-full bg-gray-200 shrink-0" />
        <div className="flex-1 space-y-4 w-full">
          <div className="h-8 w-48 bg-gray-300 rounded" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-20 bg-gray-100 rounded-full" />
            <div className="h-6 w-24 bg-gray-100 rounded-full" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-200 rounded-xl" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-200 rounded-xl" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-200 rounded-xl" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function MatchesSkeleton() {
  return (
    <div className="max-w-xl mx-auto aspect-[3/4] bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden animate-pulse relative flex flex-col justify-end p-8">
      <div className="absolute inset-0 bg-gray-200" />
      <div className="relative z-10 space-y-4">
        <div className="h-8 w-2/3 bg-gray-300 rounded" />
        <div className="h-4 w-1/2 bg-gray-200 rounded" />
        <div className="flex gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-300" />
          <div className="h-12 w-12 rounded-full bg-gray-300" />
          <div className="h-12 w-12 rounded-full bg-gray-300" />
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-12 w-48 bg-gray-300 rounded animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 pt-4 animate-pulse">
        <div className="bg-white rounded-3xl border border-gray-100 h-[400px]" />
        <div className="bg-white rounded-3xl border border-gray-100 h-[400px]" />
      </div>
    </div>
  );
}
