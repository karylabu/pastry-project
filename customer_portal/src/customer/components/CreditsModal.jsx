import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { ROOT_BASE } from '../../services/config';

const teamMembers = [
  { name: 'Karyl C. Hernandez', role: 'Project Lead' },
  { name: 'Erryca Bianca M. Abistado', role: 'Core Development Team' },
  { name: 'Abbygail Eunice Talas', role: 'Core Development Team' },
];

export default function CreditsModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-5 lg:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="credits-modal-title"
        className="relative flex h-full w-full max-w-[1400px] flex-col justify-center overflow-hidden rounded-2xl border border-[#ead8c5] bg-[#fffaf3] p-4 text-[#1a1a1a] shadow-2xl sm:p-6 lg:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close credits"
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#ead8c5] bg-white text-[#4a2b20] transition hover:bg-[#fdf3d7]"
        >
          <X size={18} />
        </button>

        <header className="flex flex-col items-center px-8 text-center">
          <img
            src={`${ROOT_BASE}/uploads/logo.png?v=logo-v2`}
            alt="Pastry Project logo"
            className="h-12 w-12 object-contain sm:h-16 sm:w-16"
          />
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#b18a23]">Made with care</p>
          <h2 id="credits-modal-title" className="mt-1 text-xl font-black tracking-tight text-[#4a2b20] sm:text-3xl">
            Pastry Project Credits
          </h2>
          <p className="mt-2 max-w-xl text-xs leading-5 text-gray-600 sm:text-sm sm:leading-6">
            Pastry Project is an online bakery platform for browsing products, placing orders, requesting custom cakes,
            and managing customer accounts.
          </p>
        </header>

        <section className="mt-4 sm:mt-6">
          <div className="mb-2 text-center sm:text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#b18a23]">The people behind the project</p>
            <h3 className="mt-1 text-lg font-bold text-[#4a2b20] sm:text-xl">Core Development Team</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
            {teamMembers.map((member, index) => (
              <article key={member.name} className="rounded-2xl border border-[#ead8c5] bg-white/70 p-3 sm:p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff1d8] text-xs font-black text-[#8b6a24] sm:h-10 sm:w-10 sm:text-sm">
                  {member.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                </div>
                <h4 className="mt-2 text-xs font-bold text-[#2f241f] sm:text-sm">{member.name}</h4>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#a06a2c] sm:text-[10px]">{member.role}</p>
                {index === 0 && (
                  <p className="mt-1 text-[11px] leading-4 text-gray-600 sm:text-xs sm:leading-5">
                    Leads project direction and coordinates the team&apos;s development work.
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-4 border-t border-[#ead8c5] pt-3 text-center sm:mt-5 sm:pt-4">
          <h3 className="text-sm font-bold text-[#4a2b20]">About this project</h3>
          <p className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-gray-600">
            The team works together to design, develop, and maintain the Pastry Project customer experience and its
            supporting bakery-management features. Product names, branding, and the Pastry Project logo belong to their
            respective owners.
          </p>
          <p className="mt-4 text-[11px] text-gray-500">© 2017 Pastry Project Bakeshop &amp; Café. All rights reserved.</p>
        </footer>
      </section>
    </div>
  );
}
