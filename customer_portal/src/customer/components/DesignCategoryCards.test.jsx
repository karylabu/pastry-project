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
      expect(screen.getByRole('button', { name: new RegExp(label) })).toHaveClass('bg-white', 'border', 'rounded-[22px]');
    });
  });

  it('shows the collection heading, subtitle, and responsive category grid', () => {
    render(<DesignCategoryCards onSelectCategory={jest.fn()} />);

    expect(screen.getByText('Explore Our Collection')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Customize Categories' })).toHaveClass('font-serif');
    expect(screen.getByText('Make it yours! Choose a category and let us bring your dream cake to life.')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Cake design categories' })).toHaveClass('grid-cols-2', 'sm:grid-cols-3', 'lg:grid-cols-6');
  });

  it('shows each category icon in a pastel badge overlapping the photo edge', () => {
    render(<DesignCategoryCards onSelectCategory={jest.fn()} />);

    DESIGN_CATEGORIES.forEach(({ label, accent }) => {
      const image = screen.getByRole('img', { name: `${label} cake design` });
      const imageFrame = image.parentElement.parentElement;
      const badge = imageFrame.querySelector('span.z-10');

      expect(badge).toHaveClass('-bottom-4', 'rounded-full', 'border-2', 'border-white');
      expect(badge).toHaveClass(...accent.split(' '));
      expect(imageFrame.nextElementSibling).toHaveClass('pl-12');
    });
  });

  it('opens the selected category gallery', () => {
    const onSelectCategory = jest.fn();

    render(<DesignCategoryCards onSelectCategory={onSelectCategory} />);
    fireEvent.click(screen.getByRole('button', { name: /kids themes/i }));

    expect(onSelectCategory).toHaveBeenCalledWith('/customer/kids-designs');
  });
});
