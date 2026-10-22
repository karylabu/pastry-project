import React from 'react';
import { ArrowRight, Cake, Flower2, Heart, HeartHandshake, PawPrint, TreePine } from 'lucide-react';
import { ROOT_BASE } from '../../services/config';

export const DESIGN_CATEGORIES = [
  {
    label: 'Birthday',
    image: `${ROOT_BASE}/uploads/birthday(1).jpg`,
    path: '/customer/birthday-designs',
    Icon: Cake,
    accent: 'bg-[#e98ba5]',
  },
  {
    label: 'Cutesy',
    image: `${ROOT_BASE}/uploads/cutesy(1).jpg`,
    path: '/customer/cutesy-designs',
    Icon: Heart,
    accent: 'bg-[#a88bc9]',
  },
  {
    label: 'Holidays',
    image: `${ROOT_BASE}/uploads/holiday(1).jpg`,
    path: '/customer/holiday-designs',
    Icon: TreePine,
    accent: 'bg-[#79a18d]',
  },
  {
    label: 'Kids Themes',
    image: `${ROOT_BASE}/uploads/kids(1).jpg`,
    path: '/customer/kids-designs',
    Icon: PawPrint,
    accent: 'bg-[#f0b62e]',
  },
  {
    label: 'Wedding',
    image: `${ROOT_BASE}/uploads/wedding(1).jpg`,
    path: '/customer/wedding-designs',
    Icon: HeartHandshake,
    accent: 'bg-[#df8b91]',
  },
  {
    label: 'Floral Designs',
    image: `${ROOT_BASE}/uploads/floral(1).jpg`,
    path: '/customer/floral-designs',
    Icon: Flower2,
    accent: 'bg-[#a8a982]',
  },
];

export default function DesignCategoryCards({ onSelectCategory, className = '' }) {
  return (
    <section className={`rounded-2xl bg-[#fffaf7] px-3 py-4 sm:px-5 sm:py-5 ${className}`.trim()}>
      <div className="mb-4 sm:mb-5">
        <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#b17876] sm:text-[10px]">
          Explore Our
        </p>
        <h2 className="mt-0.5 font-serif text-2xl font-bold text-[#33251e] sm:text-3xl md:text-4xl">
          Customize Categories
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[#8b817a] sm:text-sm">
          Make it yours! Choose a category and let us bring your dream cake to life.
        </p>
      </div>
      <nav
        aria-label="Cake design categories"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6"
      >
        {DESIGN_CATEGORIES.map(({ label, image, path, Icon, accent }) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelectCategory(path)}
            className="group flex h-full min-w-0 flex-col rounded-[22px] border border-[#f0e6df] bg-white/80 p-2 shadow-[0_5px_14px_rgba(91,64,39,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-[#e7c875] hover:shadow-[0_10px_22px_rgba(91,64,39,0.13)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b68b43] sm:p-2.5"
          >
            <span className="relative block h-36 w-full flex-none overflow-hidden rounded-[18px] bg-[#f8eee8] sm:h-40">
              <img
                src={image}
                alt={`${label} cake design`}
                loading="lazy"
                className="h-full w-full rounded-[18px] object-cover object-center transition-transform duration-500 group-hover:scale-[1.04]"
              />
              <span className={`absolute -bottom-3 left-1.5 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white text-white shadow-sm sm:left-2 sm:h-11 sm:w-11 ${accent}`}>
                <Icon aria-hidden="true" size={20} strokeWidth={1.7} />
              </span>
            </span>
            <span className="mt-auto flex h-10 w-full flex-none items-center justify-between gap-1 pl-1.5 pr-0.5 sm:pl-2">
              <span className="min-w-0 font-serif text-[13px] font-semibold italic leading-tight text-[#49392f] sm:text-base">
                {label}
              </span>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white transition-transform duration-200 group-hover:translate-x-0.5 ${accent}`}>
                <ArrowRight aria-hidden="true" size={14} strokeWidth={2} />
              </span>
            </span>
          </button>
        ))}
      </nav>
    </section>
  );
}
