import React from 'react';
import DesignGallery from './DesignGallery';

export default function FloralDesigns() {
  return <DesignGallery category="Floral Designs" folder="floral" description="Fresh floral cake ideas with delicate details for every special occasion." zoomItems={['Floral Designs Cake 5', 'Floral Designs Cake 6']} imagePositions={{ 'Floral Designs Cake 5': 'center 40%', 'Floral Designs Cake 6': 'center 40%', 'Floral Designs Cake 7': 'center 60%', 'Floral Designs Cake 8': 'center 70%' }} />;
}
