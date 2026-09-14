import React from 'react';
import DesignGallery from './DesignGallery';

export default function KidsDesigns() {
  return <DesignGallery category="Kids Themes" folder="kids" description="Fun, colorful cake designs made for magical birthday moments." zoomItems={['Kids Themes Cake 5', 'Kids Themes Cake 7', 'Kids Themes Cake 8', 'Kids Themes Cake 9']} lowerItems={['Kids Themes Cake 2', 'Kids Themes Cake 3', 'Kids Themes Cake 4', 'Kids Themes Cake 5', 'Kids Themes Cake 6', 'Kids Themes Cake 7']} extraLowerItems={['Kids Themes Cake 6']} imagePositions={{ 'Kids Themes Cake 5': 'center 30%', 'Kids Themes Cake 8': 'center 30%', 'Kids Themes Cake 9': 'center 50%' }} />;
}
