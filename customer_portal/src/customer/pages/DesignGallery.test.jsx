import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useLocation, useNavigate } from 'react-router-dom';
import DesignGallery from './DesignGallery';

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn(),
  useNavigate: jest.fn(),
}));

describe('DesignGallery reference selection', () => {
  const navigate = jest.fn();

  beforeEach(() => {
    window.sessionStorage.clear();
    navigate.mockClear();
    useNavigate.mockReturnValue(navigate);
    useLocation.mockReturnValue({
      pathname: '/customer/birthday-designs',
      state: { referenceFiles: [], selectedReferenceImages: [] },
    });
  });

  it('stores multiple example references and returns them to the customize form together', () => {
    render(<DesignGallery category="Birthday Designs" folder="birthday" />);

    const addButtons = screen.getAllByRole('button', { name: 'Add as Reference' });
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[1]);

    const savedReferences = JSON.parse(window.sessionStorage.getItem('customCakeReferenceImages'));
    expect(savedReferences).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Use 2 References' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Use 2 References' }));
    expect(navigate).toHaveBeenCalledWith('/customer/customized-cakes', {
      state: expect.objectContaining({
        scrollToRequestForm: true,
        selectedReferenceImages: savedReferences,
      }),
    });
  });

  it('caps gallery references at five images', () => {
    render(<DesignGallery category="Birthday Designs" folder="birthday" />);

    const addButtons = screen.getAllByRole('button', { name: 'Add as Reference' });
    addButtons.slice(0, 5).forEach((button) => fireEvent.click(button));

    expect(JSON.parse(window.sessionStorage.getItem('customCakeReferenceImages'))).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Use 5 References' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Max Reached' })).toHaveLength(5);
  });

  it('counts uploaded files toward the five-image limit', () => {
    useLocation.mockReturnValue({
      pathname: '/customer/birthday-designs',
      state: { referenceFiles: Array.from({ length: 4 }, (_, index) => ({ name: `upload-${index}.jpg` })) },
    });

    render(<DesignGallery category="Birthday Designs" folder="birthday" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add as Reference' })[0]);

    expect(JSON.parse(window.sessionStorage.getItem('customCakeReferenceImages'))).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Use 1 Reference' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Max Reached' })).toHaveLength(9);
  });
});
