import React from 'react';
import DesignGallery from './DesignGallery';

export default function CutesyDesigns() {
  return (
    <DesignGallery
      category="Cutesy"
      folder="cutesy"
      description="Playful, colorful cake ideas for sweet celebrations and happy little moments."
      zoomItems={['Cutesy Cake 3', 'Cutesy Cake 4', 'Cutesy Cake 5', 'Cutesy Cake 6']}
      lowerItems={['Cutesy Cake 2', 'Cutesy Cake 3', 'Cutesy Cake 4']}
      imagePositions={{
        'Cutesy Cake 1': 'center 60%',
        'Cutesy Cake 2': 'center 40%',
        'Cutesy Cake 3': 'center 40%',
        'Cutesy Cake 4': 'center 40%',
        'Cutesy Cake 5': 'center 30%',
      }}
    />
  );
}
