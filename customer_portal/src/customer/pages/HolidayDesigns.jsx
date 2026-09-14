import React from 'react';
import DesignGallery from './DesignGallery';

export default function HolidayDesigns() {
  return <DesignGallery category="Holiday" folder="holiday" description="Festive cake designs for every holiday gathering and celebration." zoomItems={['Holiday Cake 7']} imagePositions={{ 'Holiday Cake 4': 'center 60%', 'Holiday Cake 5': 'center 60%', 'Holiday Cake 7': 'center 60%', 'Holiday Cake 8': 'center 60%' }} />;
}
