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
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#211812]/70 p-3 backdrop-blur-[3px] sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="credits-modal-title"
        className="relative flex max-h-[90dvh] w-full max-w-[780px] flex-col overflow-hidden rounded-[26px] border border-[#d9c29c] bg-[#fffaf3] text-[#2f241f] shadow-[0_28px_90px_rgba(0,0,0,0.32)]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#ead8c5] bg-[#fff4df] px-4 py-3 sm:px-7 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={`${ROOT_BASE}/uploads/logo.png?v=logo-v2`}
              alt="Pastry Project logo"
              className="h-11 w-11 shrink-0 rounded-full bg-white p-1 object-contain sm:h-14 sm:w-14"
            />
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#9a7024] sm:text-[10px]">A little appreciation</p>
              <h2 id="credits-modal-title" className="mt-0.5 text-lg font-black leading-tight text-[#4a2b20] sm:text-2xl">
                Pastry Project
              </h2>
              <p className="text-[11px] text-[#765e4f] sm:text-xs">Credits &amp; project team</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close credits"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#6c5140] transition hover:bg-[#f0dfc2] hover:text-[#321d13]"
          >
            <X size={20} />
          </button>
        </header>

        <main className="px-4 py-4 sm:px-7 sm:py-6">
          <section className="border-b border-[#ead8c5] pb-4 sm:pb-5">
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-[#7b4d30] sm:text-sm">About the project</h3>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-[#695b53] sm:text-sm sm:leading-6">
              Pastry Project is an online bakery platform for browsing products, placing orders, requesting custom cakes,
              and managing customer accounts. Our team brings the experience together from design to development.
            </p>
          </section>

          <section className="pt-4 sm:pt-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.19em] text-[#a27831] sm:text-[10px]">The people behind it</p>
                <h3 className="mt-1 text-base font-extrabold text-[#4a2b20] sm:text-lg">Core Development Team</h3>
              </div>
              <span className="pb-0.5 text-[10px] font-medium text-[#8a776c]">Project contributors</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
              {teamMembers.map((member, index) => (
                <article key={member.name} className="flex min-h-[76px] items-center gap-3 rounded-xl border border-[#ead8c5] bg-white/75 px-3 py-3 sm:min-h-[96px] sm:px-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#6b3d2a] text-xs font-black text-[#fff4df] shadow-sm sm:h-11 sm:w-11 sm:text-sm">
                    {member.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold leading-4 text-[#33251e] sm:text-sm sm:leading-5">{member.name}</h4>
                    {member.role === 'Project Lead' && (
                      <p className="mt-1 text-[10px] font-bold text-[#a27831] sm:text-xs">Project Lead</p>
                    )}
                    {index === 0 && (
                      <p className="mt-1 hidden text-[10px] leading-4 text-[#817168] sm:block">Guiding the project and team.</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <p className="mt-4 rounded-xl bg-[#f5ecd9] px-3 py-2.5 text-[11px] leading-4 text-[#695b53] sm:mt-5 sm:px-4 sm:py-3 sm:text-xs sm:leading-5">
            Thank you for being part of the Pastry Project community. The project name and logo belong to their respective owners.
          </p>
        </main>

        <footer className="flex items-center justify-between gap-3 border-t border-[#ead8c5] bg-[#fffdf9] px-4 py-3 sm:px-7">
          <p className="text-[10px] text-[#8a776c] sm:text-xs">© 2017 Pastry Project Bakeshop &amp; Café</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#6b3d2a] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#512c1d] focus:outline-none focus:ring-2 focus:ring-[#c49a52] focus:ring-offset-2"
          >
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}
