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
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="credits-modal-title"
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[#ead8c5] bg-[#fffaf3] p-5 text-[#1a1a1a] shadow-2xl sm:p-8"
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
            className="h-16 w-16 object-contain sm:h-20 sm:w-20"
          />
          <p className="mt-3 text-[10px] font-black uppercase tracking-[0.3em] text-[#b18a23]">Made with care</p>
          <h2 id="credits-modal-title" className="mt-1 text-2xl font-black tracking-tight text-[#4a2b20] sm:text-3xl">
            Pastry Project Credits
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-gray-600">
            Pastry Project is an online bakery platform for browsing products, placing orders, requesting custom cakes,
            and managing customer accounts.
          </p>
        </header>

        <section className="mt-7">
          <div className="mb-3 text-center sm:text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#b18a23]">The people behind the project</p>
            <h3 className="mt-1 text-lg font-bold text-[#4a2b20] sm:text-xl">Core Development Team</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {teamMembers.map((member, index) => (
              <article key={member.name} className="rounded-2xl border border-[#ead8c5] bg-white/70 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff1d8] text-sm font-black text-[#8b6a24]">
                  {member.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                </div>
                <h4 className="mt-3 text-sm font-bold text-[#2f241f]">{member.name}</h4>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#a06a2c]">{member.role}</p>
                {index === 0 && (
                  <p className="mt-2 text-xs leading-5 text-gray-600">
                    Leads project direction and coordinates the team&apos;s development work.
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-6 border-t border-[#ead8c5] pt-5 text-center">
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
