import React from "react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#f8f5ed] px-6 py-24 text-[#1a1a1a]">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[#d4af37]">Terms &amp; Conditions</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight">Our service terms</h1>
        <p className="mt-6 text-lg leading-8 text-gray-700">
          By using our services, you agree to the policies and practices described here. These terms cover
          ordering, payments, delivery, cancellations, and customer responsibilities.
        </p>
        <div className="mt-10 rounded-3xl border border-[#d4af37]/30 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold">Highlights</h2>
          <ul className="mt-4 space-y-3 text-gray-700">
            <li>• Orders are subject to availability and confirmation.</li>
            <li>• Delivery timing may vary depending on location and traffic.</li>
            <li>• Please provide accurate contact and address details.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
