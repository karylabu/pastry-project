import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ROOT_BASE } from '../../services/config';

const teamMembers = [
  { name: 'Karyl C. Hernandez', role: 'Project Lead' },
  { name: 'Erryca Bianca M. Abistado', role: 'Core Development Team' },
  { name: 'Abbygail Eunice Talas', role: 'Core Development Team' },
];

export default function CreditsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#fffaf3] font-['DM_Sans'] text-[#1a1a1a]">
      <header className="sticky top-0 z-50 border-b border-[#f0e7cb] bg-[#fffdf9] backdrop-blur-sm">
        <div className="mx-auto flex max-w-[95rem] items-center gap-3 px-3 py-3 sm:px-4 lg:px-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/40 bg-[#fffaf0] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#171717] transition hover:border-[#d4af37] hover:bg-[#fdf3d7]"
          >
            ← Back
          </button>
          <div className="flex items-center gap-3">
            <img
              src={`${ROOT_BASE}/uploads/logo.png?v=logo-v2`}
              alt="Pastry Project logo"
              className="h-9 w-9 object-contain"
            />
            <p className="text-base font-black tracking-tight text-[#171717] sm:text-lg">Pastry Project</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col items-center text-center">
          <img
            src={`${ROOT_BASE}/uploads/logo.png?v=logo-v2`}
            alt="Pastry Project logo"
            className="h-20 w-20 object-contain sm:h-24 sm:w-24"
          />
          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.3em] text-[#b18a23]">Made with care</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#4a2b20] sm:text-4xl">Credits</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
            Pastry Project is an online bakery platform for browsing products, placing orders, requesting custom cakes,
            and managing customer accounts.
          </p>
        </div>

        <section className="mt-9 sm:mt-12">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#b18a23]">The people behind the project</p>
            <h2 className="mt-1 text-xl font-bold text-[#4a2b20] sm:text-2xl">Core Development Team</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teamMembers.map((member, index) => (
              <article key={member.name} className="rounded-2xl border border-[#ead8c5] bg-white/70 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff1d8] text-sm font-black text-[#8b6a24]">
                  {member.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                </div>
                <h3 className="mt-4 text-base font-bold text-[#2f241f]">{member.name}</h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#a06a2c]">{member.role}</p>
                {index === 0 && (
                  <p className="mt-3 text-sm leading-6 text-gray-600">
                    Leads project direction and coordinates the team&apos;s development work.
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 border-t border-[#ead8c5] pt-6 text-center sm:mt-10 sm:pt-8">
          <h2 className="text-base font-bold text-[#4a2b20]">About this project</h2>
          <p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            The team works together to design, develop, and maintain the Pastry Project customer experience and its
            supporting bakery-management features. Product names, branding, and the Pastry Project logo belong to their
            respective owners.
          </p>
          <p className="mt-5 text-xs text-gray-500">© 2017 Pastry Project Bakeshop &amp; Café. All rights reserved.</p>
        </section>
      </main>
    </div>
  );
}
