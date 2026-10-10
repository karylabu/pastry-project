import React, { useEffect } from 'react';
import { Cake, Heart, Leaf, Users, X } from 'lucide-react';
import { ROOT_BASE } from '../../services/config';

const teamMembers = [
  {
    initials: 'KC',
    name: 'Karyl C. Hernandez',
    role: 'Project Lead',
    description: 'Guiding the project and team.',
  },
  {
    initials: 'EB',
    name: 'Erryca Bianca M. Abistado',
    role: 'Core Development Team',
    description: 'Helping shape and build the customer experience.',
  },
  {
    initials: 'AT',
    name: 'Abbygail Eunice Talas',
    role: 'Core Development Team',
    description: 'Building features and supporting the system.',
  },
];

function DividerHeading({ icon: Icon, children, trailing }) {
  return (
    <div className="mb-3 flex items-center gap-3 text-[#986b2e]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4a2b20] text-[#f5d493] shadow-sm">
        <Icon size={16} strokeWidth={1.8} />
      </span>
      <h3 className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] sm:text-xs">{children}</h3>
      <span className="h-px min-w-3 flex-1 bg-[#dfc69d]" />
      {trailing && <span className="shrink-0 font-serif text-xs italic text-[#a77a3b] sm:text-sm">{trailing}</span>}
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
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#1c130c]/65 p-3 backdrop-blur-[5px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="credits-modal-title"
        className="relative h-fit max-h-[90dvh] w-full max-w-[820px] overflow-y-auto overflow-x-hidden rounded-[20px] border border-[#d9bd8f] bg-[#fffaf0] text-[#39271c] shadow-[0_28px_90px_rgba(21,12,5,0.38)] sm:rounded-[24px]"
      >
        <header className="relative flex min-h-[100px] items-center gap-3 overflow-hidden border-b border-[#ead9bc] bg-gradient-to-r from-[#fffaf0] via-[#fbf1df] to-[#f7ead2] px-4 py-4 sm:min-h-[118px] sm:gap-5 sm:px-7 sm:py-5">
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -left-8 h-24 w-24 rounded-full border border-[#e7c995]/50" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 right-8 h-24 w-44 rotate-[-12deg] rounded-[50%] border-t border-[#d5ad70]/60 sm:right-16" />
          <img
            src={`${ROOT_BASE}/uploads/logo.png?v=logo-v2`}
            alt="Pastry Project logo"
            className="relative z-10 h-[58px] w-[58px] shrink-0 rounded-full border-2 border-[#bd8d46] bg-[#fffdf8] p-2 object-contain sm:h-[72px] sm:w-[72px] sm:p-2.5"
          />
          <span aria-hidden="true" className="relative z-10 hidden h-[58px] w-px bg-[#cba66c] sm:block" />
          <div className="relative z-10 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#9a6a2d] sm:text-[11px] sm:tracking-[0.3em]">
              A little appreciation
            </p>
            <h2 id="credits-modal-title" className="mt-1 font-serif text-[24px] font-bold leading-none tracking-tight text-[#432719] sm:text-[32px]">
              Pastry Project
            </h2>
            <p className="mt-1.5 text-xs font-medium tracking-wide text-[#9a6a2d] sm:text-base">
              Credits &amp; Project Team
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close credits"
            className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full text-[#65452c] transition hover:bg-[#ead9bc] focus:outline-none focus:ring-2 focus:ring-[#bd8d46] sm:right-5 sm:top-5"
          >
            <X size={23} strokeWidth={1.7} />
          </button>
        </header>

        <main className="px-4 py-4 sm:px-7 sm:py-5">
          <section>
            <DividerHeading icon={Cake}>About the project</DividerHeading>
            <p className="ml-11 max-w-[720px] text-xs leading-5 text-[#66564a] sm:text-sm sm:leading-6">
              Pastry Project is an online bakery platform for browsing products, placing orders, requesting custom cakes,
              and managing customer accounts. Our team brought the experience together from design to development.
            </p>
          </section>

          <section className="mt-4 sm:mt-5">
            <DividerHeading icon={Users} trailing="Project Contributors">The people behind it</DividerHeading>
            <div className="grid gap-2 sm:ml-11 sm:grid-cols-3 sm:gap-3">
              {teamMembers.map((member) => (
                <article
                  key={member.name}
                  className="flex min-h-[80px] items-center gap-3 rounded-xl border border-[#ead7b7] bg-white/55 px-3 py-2.5 shadow-[0_3px_12px_rgba(108,73,32,0.04)] sm:min-h-[108px] sm:items-start sm:gap-3 sm:px-3 sm:py-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[2px] border-[#c39143] bg-[#432719] font-serif text-xs font-bold text-[#fff6e4] shadow-sm sm:h-[50px] sm:w-[50px] sm:text-base">
                    {member.initials}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h4 className="font-serif text-xs font-bold leading-4 text-[#432719] sm:text-sm sm:leading-5">{member.name}</h4>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.19em] text-[#a87936] sm:text-[10px]">
                      {member.role}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-4 text-[#76665b] sm:text-xs sm:leading-5">
                      {member.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-4 flex items-center gap-2.5 rounded-xl border border-[#9c6a2f] bg-gradient-to-r from-[#321b10] via-[#4b2b19] to-[#321b10] px-3 py-3 text-[#f8e7c5] shadow-[0_5px_16px_rgba(50,27,16,0.16)] sm:ml-6 sm:mt-5 sm:gap-4 sm:px-5 sm:py-3">
            <Heart className="h-5 w-5 shrink-0 text-[#d2a14f] sm:h-6 sm:w-6" strokeWidth={1.6} />
            <span className="hidden h-7 w-px bg-[#bb8c48]/70 sm:block" />
            <h3 className="shrink-0 font-serif text-base font-bold italic text-[#e1b65f] sm:text-xl">Thank you!</h3>
            <span className="hidden h-7 w-px bg-[#bb8c48]/70 sm:block" />
            <p className="text-[10px] leading-4 text-[#fff4df] sm:text-[11px] sm:leading-5">
              Thank you for being part of the Pastry Project community.
              <span className="hidden sm:inline"> Built with creativity, collaboration, and care.</span>
            </p>
            <Leaf className="ml-auto hidden h-6 w-6 shrink-0 rotate-[-25deg] text-[#c99543] sm:block" strokeWidth={1.4} />
          </section>
        </main>
      </section>
    </div>
  );
}
