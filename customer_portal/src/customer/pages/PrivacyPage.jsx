import React from "react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f8f5ed] px-6 py-24 text-[#1a1a1a]">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[#d4af37]">Privacy Policy</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight">Your privacy matters</h1>
        <p className="mt-6 text-lg leading-8 text-gray-700">
          We value your privacy and only use your information to provide our products, services, and account support.
          We do not sell your personal information to third parties.
        </p>
        <div className="mt-10 rounded-3xl border border-[#d4af37]/30 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold">What we collect</h2>
          <ul className="mt-4 space-y-3 text-gray-700">
            <li>• Name, email, and contact details</li>
            <li>• Delivery and order preferences</li>
            <li>• Account activity for service support</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
