import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { ROOT_BASE } from '../../services/config';

export const DESIGN_CATEGORIES = [
  {
    label: 'Birthday',
    description: 'Para sa pagdiriwang ng kaarawan',
    image: `${ROOT_BASE}/uploads/birthday(1).jpg`,
    path: '/customer/birthday-designs',
  },
  {
    label: 'Cutesy',
    description: 'Cute at playful na cake designs',
    image: `${ROOT_BASE}/uploads/cutesy(1).jpg`,
    path: '/customer/cutesy-designs',
  },
  {
    label: 'Holidays',
    description: 'Para sa Pasko at iba pang selebrasyon',
    image: `${ROOT_BASE}/uploads/holiday(1).jpg`,
    path: '/customer/holiday-designs',
  },
  {
    label: 'Kids Themes',
    description: 'Masayang designs para sa mga bata',
    image: `${ROOT_BASE}/uploads/kids(1).jpg`,
    path: '/customer/kids-designs',
  },
  {
    label: 'Wedding',
    description: 'Para sa kasal at engagement',
    image: `${ROOT_BASE}/uploads/wedding(1).jpg`,
    path: '/customer/wedding-designs',
  },
  {
    label: 'Floral Designs',
    description: 'Mga cake na may disenyong bulaklak',
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
      {DESIGN_CATEGORIES.map(({ label, description, image, path }) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelectCategory(path)}
          className="group flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl px-1.5 py-2 text-center text-[#49392f] transition duration-200 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b68b43] sm:gap-2 sm:py-3"
        >
          <span className="block h-16 w-16 rounded-full bg-gradient-to-br from-[#f3e7c9] via-[#fffaf0] to-[#ead7b4] p-[3px] shadow-[0_3px_9px_rgba(91,64,39,0.12)] sm:h-24 sm:w-24">
            <img
              src={image}
              alt={`${label} cake design`}
              loading="lazy"
              className="h-full w-full rounded-full border-2 border-white object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          </span>
          <span className="flex min-h-5 w-full items-center justify-center gap-1 text-[9px] font-semibold leading-tight tracking-[-0.01em] sm:text-[11px]">
            <span>{label}</span>
            <ArrowUpRight
              aria-hidden="true"
              size={13}
              strokeWidth={1.8}
              className="shrink-0 text-[#aa8546] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </span>
          <span className="min-h-8 text-[8px] leading-tight text-[#806f63] sm:min-h-9 sm:text-[10px]">
            {description}
          </span>
        </button>
      ))}
    </nav>
  );
}
