import React from "react";

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-[#f8f5ed] px-6 py-24 text-[#1a1a1a]">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[#d4af37]">Careers</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight">Join the Pastry Project team</h1>
        <p className="mt-6 text-lg leading-8 text-gray-700">
          We’re always looking for passionate people who love creating memorable desserts, excellent service,
          and a warm customer experience. If you enjoy baking, hospitality, and teamwork, we’d love to hear from you.
        </p>
        <div className="mt-10 rounded-3xl border border-[#d4af37]/30 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold">What we’re looking for</h2>
          <ul className="mt-4 space-y-3 text-gray-700">
            <li>• Friendly, dependable team members</li>
            <li>• Creative bakers and food service staff</li>
            <li>• People who value quality and consistency</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
