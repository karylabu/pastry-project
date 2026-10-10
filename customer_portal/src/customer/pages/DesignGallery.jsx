import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { ROOT_BASE } from '../../services/config';

const MAX_REFERENCE_IMAGES = 5;

export default function DesignGallery({ category, folder, backPath = '/customer/customized-cakes', zoomItems = [], lowerItems = [], extraLowerItems = [], imagePositions = {} }) {
  const navigate = useNavigate();
  const location = useLocation();
  const uploadedReferenceCount = Array.isArray(location.state?.referenceFiles) ? location.state.referenceFiles.length : 0;
  const maxGalleryReferences = Math.max(0, MAX_REFERENCE_IMAGES - uploadedReferenceCount);
  const [previewImage, setPreviewImage] = useState(null);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState([]);
  const displayCategory = category.replace(/\s+designs$/i, '');
  const images = Array.from({ length: 10 }, (_, index) => ({
    id: `${folder}-${index + 1}`,
    url: `${ROOT_BASE}/uploads/${folder}(${index + 1}).jpg${folder === 'wedding' && index === 0 ? '?v=wedding-1-updated' : '?v=' + folder + '-updated'}`,
    name: `${category} Cake ${index + 1}`,
  }));

  const getStoredReferences = () => {
    try {
      const rawValues = [
        window.sessionStorage.getItem('customCakeReferenceImages'),
        window.sessionStorage.getItem('customCakeReferenceImage'),
      ].filter(Boolean);

      const parsed = rawValues.flatMap((storedValue) => {
        const value = JSON.parse(storedValue || 'null');
        if (!value) return [];
        return Array.isArray(value) ? value : [value];
      }).filter(Boolean);

      return parsed
        .map((item) => ({
          type: item.type || 'example',
          id: item.id || item.url || item.src,
          url: item.url || item.src,
          name: item.name || item.label || 'Reference image',
        }))
        .filter((item, index, items) => (
          item.id && items.findIndex((candidate) => candidate.id === item.id && candidate.url === item.url) === index
        ));
    } catch {
      return [];
    }
  };
  const returnToCustomize = () => {
    navigate(backPath, {
      state: {
        scrollToRequestForm: true,
        referenceFiles: location.state?.referenceFiles || [],
        selectedReferenceImages: getStoredReferences(),
      },
    });
  };

  const selectReference = (image) => {
    const reference = {
      type: 'example',
      id: image.id,
      url: image.url,
      name: image.name,
    };

    const alreadySelected = selectedReferenceIds.includes(image.id);
    const existingReferences = getStoredReferences();
    const combinedIds = alreadySelected
      ? selectedReferenceIds.filter((id) => id !== image.id)
      : [...selectedReferenceIds, image.id];

    if (!alreadySelected && combinedIds.length > maxGalleryReferences) {
      return;
    }

    const selectedReferences = combinedIds
      .map((id) => {
        if (id === image.id) return reference;
        return existingReferences.find((item) => item.id === id) || images.find((item) => item.id === id);
      })
      .filter(Boolean)
      .map((item) => ({
        type: 'example',
        id: item.id,
        url: item.url,
        name: item.name,
      }));

    const dedupedReferences = selectedReferences.filter((item, index, all) => (
      item.id && all.findIndex((candidate) => candidate.id === item.id && candidate.url === item.url) === index
    ));

    try {
      window.sessionStorage.setItem('customCakeReferenceImages', JSON.stringify(dedupedReferences));
      window.sessionStorage.removeItem('customCakeReferenceImage');
    } catch (error) {
      console.warn('Could not save gallery references:', error);
    }
    setSelectedReferenceIds(combinedIds);
    setPreviewImage(null);
  };

  React.useEffect(() => {
    setSelectedReferenceIds(getStoredReferences().map((reference) => reference.id).filter(Boolean));
  }, []);

  const handleUseAsReference = (image) => {
    selectReference(image);
  };

  const confirmPreview = () => {
    if (!previewImage) return;
    handleUseAsReference(previewImage);
  };

  return (
    <PageShell background="bg-[#fffaf3]" padding="px-4 py-6 md:px-7 lg:px-10" innerClassName="max-w-6xl">
      <button type="button" onClick={returnToCustomize} className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-[#765d50] transition hover:text-[#8d6a2e]">
        <ArrowLeft size={15} /> Back to customize
      </button>
      {selectedReferenceIds.length > 0 && (
        <button
          type="button"
          onClick={returnToCustomize}
          className="mb-5 ml-3 rounded-lg bg-[#ffe89a] px-4 py-2 text-xs font-bold text-[#6b4f1d] transition hover:bg-[#ffedb5]"
        >
          Use {selectedReferenceIds.length} Reference{selectedReferenceIds.length === 1 ? '' : 's'}
        </button>
      )}

      {selectedReferenceIds.length + uploadedReferenceCount >= MAX_REFERENCE_IMAGES && (
        <p className="mb-4 rounded-lg border border-[#f0d98a] bg-[#fff9df] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7a5b20]">
          Up to {MAX_REFERENCE_IMAGES} reference images per request.
        </p>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between px-1"><div><p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#9b7b3d]">Made for special moments</p><h2 className="mt-1 font-serif text-2xl font-bold text-[#33251e]">{displayCategory} Designs</h2></div><span className="text-[10px] font-semibold text-[#9b8c83]">{images.length} designs</span></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {images.map((image) => (
            <article key={image.id} className="group overflow-hidden rounded-xl border border-[#eadfd8] bg-white shadow-[0_6px_16px_rgba(91,64,39,0.06)] transition hover:-translate-y-0.5 hover:border-[#e7c875] hover:shadow-[0_10px_20px_rgba(91,64,39,0.1)]">
              <button type="button" onClick={() => setPreviewImage(image)} className="block w-full text-left">
                <div className="h-40 overflow-hidden bg-[#f8eee8] sm:h-44"><img src={image.url} alt={image.name} style={image.name === 'Kids Themes Cake 6' ? {
                  objectPosition: 'center top',
                  transformOrigin: 'center top',
                } : imagePositions[image.name] ? { objectPosition: imagePositions[image.name] } : extraLowerItems.includes(image.name) ? { objectPosition: 'center 15%' } : lowerItems.includes(image.name) ? { objectPosition: 'center 40%' } : undefined} className={`h-full w-full object-cover transition duration-500 ${image.name === 'Kids Themes Cake 6' ? 'translate-y-1 scale-[1.28] sm:translate-y-0 sm:scale-100' : zoomItems.includes(image.name) ? 'scale-[1.5] group-hover:scale-[1.58]' : 'group-hover:scale-105'}`} /></div>
              </button>
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-[#4b3b33]">{image.name}</span>
                <button
                  type="button"
                  onClick={() => handleUseAsReference(image)}
                  disabled={!selectedReferenceIds.includes(image.id) && selectedReferenceIds.length + uploadedReferenceCount >= MAX_REFERENCE_IMAGES}
                  className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] transition ${selectedReferenceIds.includes(image.id) ? 'bg-[#6f9d67] text-white' : selectedReferenceIds.length + uploadedReferenceCount >= MAX_REFERENCE_IMAGES ? 'cursor-not-allowed bg-[#f4e7d3] text-[#9d8a74]' : 'bg-[#fff8df] text-[#8d6a2e] hover:bg-[#ffeeb0]'}`}
                >
                  {selectedReferenceIds.includes(image.id) ? '✓ Selected' : selectedReferenceIds.length + uploadedReferenceCount >= MAX_REFERENCE_IMAGES ? 'Max Reached' : 'Add as Reference'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f1a17]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#eadfd8] bg-white shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between border-b border-[#f2e8dc] px-4 py-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b7b3d]">Reference preview</span>
              <button type="button" onClick={() => setPreviewImage(null)} className="text-lg font-semibold text-[#6b4f1d]">×</button>
            </div>
            <div className="p-4">
              <div className="h-72 overflow-hidden rounded-xl border border-[#f0d98a]">
                <img
                  src={previewImage.url}
                  alt={previewImage.name}
                  style={previewImage.name === 'Kids Themes Cake 6' ? {
                    objectPosition: 'center top',
                    transform: 'scale(1.2)',
                    transformOrigin: 'center top',
                  } : undefined}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="mt-3 text-center text-sm font-semibold text-[#4b3b33]">{previewImage.name}</p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setPreviewImage(null)} className="flex-1 rounded-xl border border-[#f0d98a] bg-white px-3 py-2 text-sm font-semibold text-[#6b4f1d]">Cancel</button>
                <button type="button" onClick={confirmPreview} className="flex-1 rounded-xl border border-[#e5bd45] bg-[#ffe89a] px-3 py-2 text-sm font-semibold text-[#6b4f1d]">Add this reference</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
