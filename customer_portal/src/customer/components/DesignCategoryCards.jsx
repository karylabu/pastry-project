import React from 'react';
import {
  ArrowRight,
  CakeSlice,
  Flower2,
  Heart,
  HeartHandshake,
  PawPrint,
  Sparkles,
  TreePine,
} from 'lucide-react';
import { ROOT_BASE } from '../../services/config';

export const DESIGN_CATEGORIES = [
  {
    label: 'Birthday',
    image: `${ROOT_BASE}/uploads/birthday(1).jpg`,
    path: '/customer/birthday-designs',
    Icon: CakeSlice,
    accent: 'bg-[#e98ba5] text-white',
  },
  {
    label: 'Cutesy',
    image: `${ROOT_BASE}/uploads/cutesy(1).jpg`,
    path: '/customer/cutesy-designs',
    Icon: Heart,
    accent: 'bg-[#a88bc9] text-white',
  },
  {
    label: 'Holidays',
    image: `${ROOT_BASE}/uploads/holiday(1).jpg`,
    path: '/customer/holiday-designs',
    Icon: TreePine,
    accent: 'bg-[#79a18d] text-white',
  },
  {
    label: 'Kids Themes',
    image: `${ROOT_BASE}/uploads/kids(1).jpg`,
    path: '/customer/kids-designs',
    Icon: PawPrint,
    accent: 'bg-[#e3ad35] text-white',
  },
  {
    label: 'Wedding',
    image: `${ROOT_BASE}/uploads/wedding(1).jpg`,
    path: '/customer/wedding-designs',
    Icon: HeartHandshake,
    accent: 'bg-[#df8b91] text-white',
  },
  {
    label: 'Floral Designs',
    image: `${ROOT_BASE}/uploads/floral(1).jpg`,
    path: '/customer/floral-designs',
    Icon: Flower2,
    accent: 'bg-[#92986b] text-white',
  },
];

export default function DesignCategoryCards({ onSelectCategory, className = '' }) {
  return (
    <section className={`relative overflow-hidden rounded-3xl border border-[#f1e6df] bg-[#FFF9F3] px-4 py-5 shadow-[0_8px_28px_rgba(91,64,39,0.055)] sm:px-6 sm:py-7 lg:px-8 lg:py-8 ${className}`.trim()}>
      <Heart
        aria-hidden="true"
        className="pointer-events-none absolute right-8 top-8 hidden h-10 w-10 rotate-12 text-[#e9bdc7] md:block"
        strokeWidth={1.2}
      />
      <div className="mb-5 text-center sm:mb-7 lg:mb-8">
        <p className="flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-[0.25em] text-[#a87379] sm:text-[10px]">
          <Sparkles aria-hidden="true" size={13} strokeWidth={1.6} />
          Explore Our Collection
          <Sparkles aria-hidden="true" size={13} strokeWidth={1.6} />
        </p>
        <h2 className="mt-2 font-serif text-2xl font-semibold leading-tight text-[#3B2A20] sm:text-3xl md:text-4xl">
          Customize Categories
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-[#786b63] sm:text-sm">
          Make it yours! Choose a category and let us bring your dream cake to life.
        </p>
      </div>
      <nav
        aria-label="Cake design categories"
        className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6 lg:gap-3 xl:gap-4"
      >
        {DESIGN_CATEGORIES.map(({ label, image, path, Icon, accent }) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelectCategory(path)}
            className={`group flex h-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#efe5df] bg-white p-2 text-left text-[#3B2A20] shadow-[0_5px_16px_rgba(73,53,43,0.07)] transition duration-300 hover:-translate-y-1 hover:border-[#d8c39b] hover:shadow-[0_14px_28px_rgba(73,53,43,0.13)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A24D] sm:rounded-[26px] sm:p-2.5 lg:p-2 xl:p-2.5`}
          >
            <span className="relative block h-28 w-full flex-none rounded-[16px] bg-[#f8eee8] sm:h-36 sm:rounded-[19px] lg:h-28 xl:h-36">
              <span className="block h-full w-full overflow-hidden rounded-[16px] sm:rounded-[19px]">
                <img
                  src={image}
                  alt={`${label} cake design`}
                  loading="lazy"
                  className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                />
              </span>
              <span className={`absolute -bottom-4 left-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow-[0_2px_8px_rgba(59,42,32,0.16)] sm:-bottom-[18px] sm:h-10 sm:w-10 ${accent}`}>
                <Icon aria-hidden="true" size={17} strokeWidth={1.7} />
              </span>
            </span>
            <span className="mt-auto flex min-h-11 w-full items-center justify-between gap-2 pl-12 pr-1.5 sm:min-h-12 sm:pl-14 sm:pr-2">
              <span className="min-w-0 font-serif text-[13px] font-semibold leading-tight text-[#3B2A20] sm:text-base lg:text-[13px] xl:text-[15px]">
                {label}
              </span>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition duration-300 group-hover:translate-x-0.5 ${accent}`}>
                <ArrowRight aria-hidden="true" size={15} strokeWidth={1.8} />
              </span>
            </span>
          </button>
        ))}
      </nav>
    </section>
  );
}
