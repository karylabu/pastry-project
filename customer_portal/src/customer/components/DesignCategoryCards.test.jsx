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
      expect(screen.getByRole('button', { name: new RegExp(label) })).toHaveClass('bg-white', 'border');
    });
  });

  it('opens the selected category gallery', () => {
    const onSelectCategory = jest.fn();

    render(<DesignCategoryCards onSelectCategory={onSelectCategory} />);
    fireEvent.click(screen.getByRole('button', { name: /kids themes/i }));

    expect(onSelectCategory).toHaveBeenCalledWith('/customer/kids-designs');
  });
});
