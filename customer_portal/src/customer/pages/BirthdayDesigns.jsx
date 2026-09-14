import React from 'react';
import DesignGallery from './DesignGallery';

export default function BirthdayDesigns() {
  return (
    <DesignGallery
      category="Birthday"
      folder="birthday"
      description="Find a sweet design for every birthday celebration, from simple favorites to statement cakes."
      zoomItems={['Birthday Cake 4', 'Birthday Cake 5']}
      lowerItems={['Birthday Cake 2', 'Birthday Cake 7']}
      imagePositions={{
        'Birthday Cake 1': 'center 60%',
        'Birthday Cake 2': 'center 40%',
        'Birthday Cake 5': 'center 40%',
        'Birthday Cake 7': 'center 40%',
        'Birthday Cake 9': 'center 60%',
      }}
    />
  );
}
