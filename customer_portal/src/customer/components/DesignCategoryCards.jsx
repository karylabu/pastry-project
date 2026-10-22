import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { ROOT_BASE } from '../../services/config';

export const DESIGN_CATEGORIES = [
  {
    label: 'Birthday',
    image: `${ROOT_BASE}/uploads/birthday(1).jpg`,
    path: '/customer/birthday-designs',
  },
  {
    label: 'Cutesy',
    image: `${ROOT_BASE}/uploads/cutesy(1).jpg`,
    path: '/customer/cutesy-designs',
  },
  {
    label: 'Holidays',
    image: `${ROOT_BASE}/uploads/holiday(1).jpg`,
    path: '/customer/holiday-designs',
  },
  {
    label: 'Kids Themes',
    image: `${ROOT_BASE}/uploads/kids(1).jpg`,
    path: '/customer/kids-designs',
  },
  {
    label: 'Wedding',
    image: `${ROOT_BASE}/uploads/wedding(1).jpg`,
    path: '/customer/wedding-designs',
  },
  {
    label: 'Floral Designs',
    image: `${ROOT_BASE}/uploads/floral(1).jpg`,
    path: '/customer/floral-designs',
  },
];

export default function DesignCategoryCards({ onSelectCategory, className = '' }) {
  return (
    <section className={className}>
      <h2 className="mb-2 font-serif text-xl text-[#33251e] sm:mb-3 md:text-2xl">
        Customize Categories
      </h2>
      <nav
        aria-label="Cake design categories"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        {DESIGN_CATEGORIES.map(({ label, image, path }) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelectCategory(path)}
            className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#eadfd8] bg-[#fffaf7] p-2 text-left text-[#33251e] shadow-[0_5px_14px_rgba(91,64,39,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#e7c875] hover:shadow-[0_10px_20px_rgba(91,64,39,0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b68b43]"
          >
            <span className="mb-2 block aspect-[4/3] w-full overflow-hidden rounded-lg border border-[#f1e6df] bg-[#f8eee8]">
              <img
                src={image}
                alt={`${label} cake design`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </span>
            <span className="flex min-h-8 w-full items-center justify-between gap-2 px-1 pb-1">
              <span className="min-w-0 text-[11px] font-bold leading-tight sm:text-sm">{label}</span>
              <ArrowUpRight
                aria-hidden="true"
                size={15}
                strokeWidth={1.8}
                className="shrink-0 text-[#aa8546] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </span>
          </button>
        ))}
      </nav>
    </section>
  );
}
