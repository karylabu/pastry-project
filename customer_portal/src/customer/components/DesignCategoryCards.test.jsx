import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import DesignCategoryCards, { DESIGN_CATEGORIES } from './DesignCategoryCards';

describe('DesignCategoryCards', () => {
  it('shows a matching image and selection button for every design category', () => {
    const onSelectCategory = jest.fn();

    render(<DesignCategoryCards onSelectCategory={onSelectCategory} />);

    DESIGN_CATEGORIES.forEach(({ label, image }) => {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: `${label} cake design` })).toHaveAttribute('src', image);
    });
    expect(screen.getByRole('heading', { name: 'Customize Categories' })).toBeInTheDocument();
  });

  it('shows every category in its own card', () => {
    render(<DesignCategoryCards onSelectCategory={jest.fn()} />);

    DESIGN_CATEGORIES.forEach(({ label }) => {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toHaveClass('rounded-[22px]', 'bg-white/80', 'border');
    });
  });

  it('uses the reference heading style and responsive category grid', () => {
    render(<DesignCategoryCards onSelectCategory={jest.fn()} />);

    expect(screen.getByText('Explore Our')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Customize Categories' })).toHaveClass('font-serif', 'text-2xl', 'md:text-4xl');
    expect(screen.getByRole('navigation', { name: 'Cake design categories' })).toHaveClass('grid-cols-2', 'sm:grid-cols-3', 'xl:grid-cols-6');
  });

  it('slightly enlarges the Cutesy and Kids Themes photos to match the other cards', () => {
    render(<DesignCategoryCards onSelectCategory={jest.fn()} />);

    expect(screen.getByRole('img', { name: 'Cutesy cake design' })).toHaveClass('scale-[1.06]');
    expect(screen.getByRole('img', { name: 'Kids Themes cake design' })).toHaveClass('scale-[1.1]');
    expect(screen.getByRole('img', { name: 'Birthday cake design' })).not.toHaveClass('scale-[1.06]', 'scale-[1.1]');
  });

  it('opens the selected category gallery', () => {
    const onSelectCategory = jest.fn();

    render(<DesignCategoryCards onSelectCategory={onSelectCategory} />);
    fireEvent.click(screen.getByRole('button', { name: /kids themes/i }));

    expect(onSelectCategory).toHaveBeenCalledWith('/customer/kids-designs');
  });
});
