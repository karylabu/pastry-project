import React from 'react';
import DesignGallery from './DesignGallery';

export default function WeddingDesigns() {
  return <DesignGallery category="Wedding" folder="wedding" description="Elegant cake inspiration for weddings, receptions, and beautiful new beginnings." zoomItems={['Wedding Cake 1', 'Wedding Cake 6']} extraLowerItems={['Wedding Cake 4']} imagePositions={{ 'Wedding Cake 1': 'center 60%', 'Wedding Cake 3': 'center 60%', 'Wedding Cake 5': 'center 40%' }} />;
}
