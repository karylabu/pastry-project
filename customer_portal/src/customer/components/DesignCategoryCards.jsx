import React from 'react';
import { ArrowRight } from 'lucide-react';
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
    <nav
      aria-label="Cake design categories"
      className={`grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3 ${className}`.trim()}
    >
      {DESIGN_CATEGORIES.map(({ label, image, path }) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelectCategory(path)}
          className="group flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-[#5f514a] transition hover:bg-[#fff8df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b68b43]"
        >
          <span className="block h-12 w-12 overflow-hidden rounded-full bg-[#f8eee8] sm:h-16 sm:w-16">
            <img
              src={image}
              alt={`${label} cake design`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-110"
            />
          </span>
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold leading-tight sm:text-[11px]">
            {label}
            <ArrowRight aria-hidden="true" size={11} strokeWidth={2} />
          </span>
        </button>
      ))}
    </nav>
  );
}
