import React, { useEffect } from 'react';
import { Cake, Heart, Leaf, Users, X } from 'lucide-react';
import { ROOT_BASE } from '../../services/config';

const teamMembers = [
  {
    initials: 'KC',
    name: 'Karyl C. Hernandez',
    role: 'PROJECT LEAD',
    description: 'Guiding the project and team.',
  },
  {
    initials: 'EB',
    name: 'Erryca Bianca M. Abistado',
    role: 'UI/UX & DEVELOPMENT',
    description: 'Designing the interface and customer experience.',
  },
  {
    initials: 'AT',
    name: 'Abbygail Eunice Talas',
    role: 'DEVELOPMENT TEAM',
    description: 'Building features and supporting system functionality.',
  },
];

function SectionHeading({ icon: Icon, children, trailing }) {
  return (
    <div className="mb-3 flex items-center gap-3 text-[#986b2e]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4a2b20] text-[#f5d493]">
        <Icon size={15} strokeWidth={1.8} />
      </span>
      <h3 className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] sm:text-xs">{children}</h3>
      <span className="h-px min-w-3 flex-1 bg-[#dfc69d]" />
      {trailing && <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.14em] text-[#a77a3b] sm:text-[9px]">{trailing}</span>}
    </div>
  );
}

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
      className="fixed inset-0 z-[100002] flex items-center justify-center bg-[#1c130c]/65 px-5 py-7 backdrop-blur-[5px] sm:px-8 sm:py-10 lg:px-12 lg:py-12"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="credits-modal-title"
        className="relative max-h-[calc(100dvh-56px)] w-full max-w-[700px] overflow-x-hidden overflow-y-auto rounded-[18px] border border-[#d9bd8f] bg-[#fffaf0] text-[#39271c] shadow-[0_28px_90px_rgba(21,12,5,0.38)] sm:max-h-[calc(100dvh-80px)] sm:rounded-[20px] md:overflow-hidden"
      >
        <header className="relative flex min-h-[96px] items-center gap-3 overflow-hidden border-b border-[#ead9bc] bg-gradient-to-r from-[#fffaf0] via-[#fbf1df] to-[#f7ead2] px-4 py-3 sm:min-h-[112px] sm:gap-4 sm:px-7 sm:py-4">
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -left-6 h-20 w-20 rounded-full border border-[#e7c995]/60" />
          <svg aria-hidden="true" viewBox="0 0 160 100" className="pointer-events-none absolute -bottom-1 right-0 h-20 w-32 text-[#d5ad70]/55 sm:h-24 sm:w-40" fill="none">
            <path d="M5 94C53 91 69 58 99 43c21-11 37-5 57-23M90 48C75 28 79 13 67 5c-1 18 5 31 23 43ZM111 38c-2-20 8-29 7-38 12 15 11 28-7 38ZM127 32c7-17 20-21 24-29 4 19-4 30-24 29ZM72 57c-21-9-34-1-43-4 12 16 26 18 43 4Z" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          <img
            src={`${ROOT_BASE}/uploads/logo.png?v=logo-v2`}
            alt="Pastry Project logo"
            className="relative z-10 h-[58px] w-[58px] shrink-0 rounded-full border-2 border-[#bd8d46] bg-[#fffdf8] p-1.5 object-contain sm:h-[70px] sm:w-[70px] sm:p-2"
          />
          <span aria-hidden="true" className="relative z-10 hidden h-[60px] w-px bg-[#cba66c] sm:block" />
          <div className="relative z-10 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#9a6a2d] sm:text-[10px] sm:tracking-[0.3em]">
              A little appreciation
            </p>
            <h2 id="credits-modal-title" className="mt-1 font-serif text-[26px] font-bold leading-none tracking-tight text-[#432719] sm:text-[34px]">
              Pastry Project
            </h2>
            <p className="mt-1.5 text-xs font-medium tracking-wide text-[#9a6a2d] sm:text-sm">
              Credits &amp; Project Team
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close credits"
            className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full text-[#65452c] transition hover:bg-[#ead9bc] focus:outline-none focus:ring-2 focus:ring-[#bd8d46] sm:right-5 sm:top-5"
          >
            <X size={22} strokeWidth={1.7} />
          </button>
        </header>

        <main className="px-4 py-4 sm:px-7 sm:py-5">
          <section>
            <SectionHeading icon={Cake}>About the project</SectionHeading>
            <p className="ml-11 max-w-[640px] text-[11px] leading-[1.35rem] text-[#66564a] sm:text-xs sm:leading-5">
              Pastry Project is an online bakery platform for browsing products, placing orders, requesting custom cakes,
              and managing customer accounts. Our team brought the experience together from design to development.
            </p>
          </section>

          <section className="mt-4 sm:mt-5">
            <SectionHeading icon={Users} trailing="3 Contributors">Meet the developers</SectionHeading>
            <div className="grid gap-2.5 sm:ml-11 sm:grid-cols-3 sm:gap-3">
              {teamMembers.map((member) => (
                <article
                  key={member.name}
                  className="flex min-h-[86px] items-center gap-2.5 rounded-xl border border-[#ead7b7] bg-white/45 px-3 py-2.5 shadow-[0_3px_12px_rgba(108,73,32,0.04)] sm:min-h-[112px] sm:items-start sm:px-3 sm:py-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#c39143] bg-[#432719] font-serif text-xs font-bold text-[#fff6e4] sm:h-11 sm:w-11 sm:text-sm">
                    {member.initials}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h4 className="font-serif text-[11px] font-bold leading-4 text-[#432719] sm:text-xs sm:leading-4">{member.name}</h4>
                    <p className="mt-1 text-[8px] font-black uppercase tracking-[0.14em] text-[#a87936] sm:text-[9px]">
                      {member.role}
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-[#76665b]">
                      {member.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="relative mt-4 flex min-h-[48px] items-center gap-3 overflow-hidden rounded-xl border border-[#ead5ac] bg-[#f4ead5] px-3 py-2.5 text-[#60452f] sm:ml-8 sm:mt-5 sm:gap-4 sm:px-5">
            <Heart className="h-5 w-5 shrink-0 text-[#8c612b]" strokeWidth={1.7} />
            <span className="h-7 w-px shrink-0 bg-[#c9a873]" />
            <p className="text-[10px] leading-4 sm:text-xs sm:leading-5">
              Thank you for being part of the Pastry Project community.
            </p>
            <svg aria-hidden="true" viewBox="0 0 80 50" className="ml-auto h-9 w-16 shrink-0 text-[#bd914f] sm:h-10 sm:w-20" fill="none">
              <path d="M3 46c25-6 39-20 74-41M31 31c-1-11 4-17 3-23 8 8 8 16-3 23ZM43 24c3-12 10-16 11-22 5 12 1 20-11 22ZM54 18c8-8 15-8 19-13 0 12-8 17-19 13ZM21 36c-10-5-17-2-21-4 5 9 12 11 21 4Z" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </section>
        </main>
      </section>
    </div>
  );
}
