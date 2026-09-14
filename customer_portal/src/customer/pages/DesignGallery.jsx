import React, { useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { ROOT_BASE } from '../../services/config';

export default function DesignGallery({ category, folder, description, backPath = '/customer/customized-cakes', zoomItems = [], lowerItems = [], extraLowerItems = [], imagePositions = {} }) {
  const navigate = useNavigate();
  const [previewImage, setPreviewImage] = useState(null);
  const [selectedReferenceId, setSelectedReferenceId] = useState(null);
  const images = Array.from({ length: 10 }, (_, index) => ({
    id: `${folder}-${index + 1}`,
    url: `${ROOT_BASE}/uploads/${folder}(${index + 1}).jpg${folder === 'wedding' && index === 0 ? '?v=wedding-1-updated' : '?v=' + folder + '-updated'}`,
    name: `${category} Cake ${index + 1}`,
  }));

  const getStoredReference = () => {
    try {
      return JSON.parse(window.sessionStorage.getItem('customCakeReferenceImage') || 'null');
    } catch {
      return null;
    }
  };

  const selectReference = (image) => {
    const referenceImage = {
      type: 'example',
      id: image.id,
      url: image.url,
      name: image.name,
    };
    try {
      window.sessionStorage.setItem('customCakeReferenceImage', JSON.stringify(referenceImage));
    } catch (error) {
      console.warn('Could not save gallery image as reference:', error);
    }
    setSelectedReferenceId(image.id);
    setPreviewImage(null);
    navigate('/customer/customized-cakes');
  };

  React.useEffect(() => {
    const stored = getStoredReference();
    if (stored?.type === 'example') setSelectedReferenceId(stored.id);
  }, []);

  const handleUseAsReference = (image) => {
    selectReference(image);
  };

  const confirmPreview = () => {
    if (!previewImage) return;
    handleUseAsReference(previewImage);
  };

  return (
    <PageShell background="bg-[#fbfaf5]" padding="px-4 py-6 md:px-7 lg:px-10" innerClassName="max-w-6xl">
      <button type="button" onClick={() => navigate(backPath)} className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-[#765d50] transition hover:text-[#8d6a2e]">
        <ArrowLeft size={15} /> Back to customize
      </button>

      <section className="mb-6 rounded-2xl border border-[#eadfd8] bg-white px-5 py-6 shadow-[0_8px_22px_rgba(91,64,39,0.05)] sm:px-8">
        <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#9b7b3d]">{category} collection</p>
        <div className="mt-1 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-serif text-3xl font-bold leading-tight text-[#33251e]">{category} Cakes</h1>
            <p className="mt-1 max-w-xl text-xs leading-5 text-[#9b8c83]">{description}</p>
          </div>
          <button type="button" onClick={() => navigate('/customer/customized-cakes')} className="inline-flex w-fit items-center gap-2 rounded-full bg-[#fff8df] px-4 py-2 text-[10px] font-bold text-[#8d6a2e] transition hover:bg-[#ffeeb0]">Customize a cake <ChevronRight size={13} /></button>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between px-1"><div><p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#9b7b3d]">Made for special moments</p><h2 className="mt-1 font-serif text-2xl font-bold text-[#33251e]">{category} Designs</h2></div><span className="text-[10px] font-semibold text-[#9b8c83]">{images.length} designs</span></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {images.map((image) => (
            <article key={image.id} className="group overflow-hidden rounded-xl border border-[#eadfd8] bg-white shadow-[0_6px_16px_rgba(91,64,39,0.06)] transition hover:-translate-y-0.5 hover:border-[#e7c875] hover:shadow-[0_10px_20px_rgba(91,64,39,0.1)]">
              <button type="button" onClick={() => setPreviewImage(image)} className="block w-full text-left">
                <div className="h-40 overflow-hidden bg-[#f8eee8] sm:h-44"><img src={image.url} alt={image.name} style={imagePositions[image.name] ? { objectPosition: imagePositions[image.name] } : extraLowerItems.includes(image.name) ? { objectPosition: 'center 15%' } : lowerItems.includes(image.name) ? { objectPosition: 'center 40%' } : undefined} className={`h-full w-full object-cover transition duration-500 ${zoomItems.includes(image.name) ? 'scale-[1.5] group-hover:scale-[1.58]' : 'group-hover:scale-105'}`} /></div>
              </button>
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-[#4b3b33]">{image.name}</span>
                <button
                  type="button"
                  onClick={() => handleUseAsReference(image)}
                  className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] transition ${selectedReferenceId === image.id ? 'bg-[#6f9d67] text-white' : 'bg-[#fff8df] text-[#8d6a2e] hover:bg-[#ffeeb0]'}`}
                >
                  {selectedReferenceId === image.id ? '✓ Using as Reference' : 'Use as Reference'}
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
              <img src={previewImage.url} alt={previewImage.name} className="h-72 w-full rounded-xl object-cover border border-[#f0d98a]" />
              <p className="mt-3 text-center text-sm font-semibold text-[#4b3b33]">{previewImage.name}</p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setPreviewImage(null)} className="flex-1 rounded-xl border border-[#f0d98a] bg-white px-3 py-2 text-sm font-semibold text-[#6b4f1d]">Cancel</button>
                <button type="button" onClick={confirmPreview} className="flex-1 rounded-xl border border-[#e5bd45] bg-[#ffe89a] px-3 py-2 text-sm font-semibold text-[#6b4f1d]">Use this image</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
