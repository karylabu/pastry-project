import React, { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { ROOT_BASE } from '../../services/config';
import BrandName from '../components/BrandName';

const categories = [
  { label: 'Orders', icon: '📦' },
  { label: 'Delivery & Pickup', icon: '🚚' },
  { label: 'Payments', icon: '💳' },
  { label: 'Customized Orders', icon: '🎂' },
  { label: 'Loyalty & Rewards', icon: '🎁' },
  { label: 'Vouchers & Promotions', icon: '🎟️' },
];

const faqGroups = [
  {
    title: 'Orders',
    items: [
      {
        question: 'How do I place an order?',
        answer:
          'Browse the available products, select the item you want, add it to your bag, and proceed to checkout. Review your order details and complete the required payment or selected payment process.',
      },
      {
        question: 'What is the process for ordering finished products?',
        answer:
          'Browse the Menu and choose an available finished product. Select the product options and quantity, then add it to your bag. When you are ready, open your bag and continue to checkout, provide your delivery or pickup details, review your order, and submit it using an available payment method.',
      },
      {
        question: 'Can I change my order after placing it?',
        answer:
          'Order changes may be requested before the preparation process begins. Once an order is already being prepared, changes may no longer be possible.',
      },
      {
        question: 'Can I cancel my order?',
        answer:
          'Cancellation requests depend on the current status of your order. Orders that are already being prepared, completed, or transferred for delivery may no longer be eligible for cancellation.',
      },
    ],
  },
  {
    title: 'Delivery & Pickup',
    items: [
      {
        question: 'How long does delivery take?',
        answer:
          'Delivery time may vary depending on the customer\'s location, traffic conditions, weather, order volume, and product preparation time.',
      },
      {
        question: 'Can I choose pickup instead of delivery?',
        answer:
          'Yes. During checkout, you may select pickup if the option is available for your order.',
      },
      {
        question: 'What happens if I am unavailable during delivery?',
        answer:
          'Please make sure that you or an authorized recipient is available to receive the order. You may be contacted using the information provided during checkout.',
      },
    ],
  },
  {
    title: 'Payments',
    items: [
      {
        question: 'What payment methods are accepted?',
        answer:
          'Available payment methods will be displayed during the checkout process.',
      },
      {
        question: 'When will my order be confirmed?',
        answer:
          'Order confirmation may depend on the selected payment method and successful completion of the required order process.',
      },
    ],
  },
  {
    title: 'Customized Orders',
    items: [
      {
        question: 'How do I request a customized cake?',
        answer:
          'Select the customization option and provide the required details, such as your preferred design, flavor, size, message, preferred date, and reference image if applicable.',
      },
      {
        question: 'What is the process for ordering a customized cake?',
        answer:
          'Open Customize Your Dream Cake, choose the cake type, flavor, and size, then provide the occasion and design details. You can also include your budget, quantity, add-ons, and reference images. Sign in and send your request. The admin will review it within 24 hours and send the final price and decision. Your request is not confirmed until it is accepted.',
      },
      {
        question: 'Can my cake look exactly like my reference image?',
        answer:
          'We will make reasonable efforts to follow your requested design. However, slight differences may occur depending on available ingredients, decorations, colors, and materials.',
      },
      {
        question: 'Can I change my customized order?',
        answer:
          'Changes may be limited once preparation has started. Please review all customization details carefully before confirming your order.',
      },
    ],
  },
  {
    title: 'Loyalty & Rewards',
    items: [
      {
        question: 'How do I earn loyalty points?',
        answer:
          'Loyalty points are earned from eligible completed orders according to the Pastry Project Loyalty Rewards Program.',
      },
      {
        question: 'When will my points be added?',
        answer:
          'Points are added after an eligible order has been successfully completed.',
      },
      {
        question: 'Can I exchange points for cash?',
        answer:
          'No. Loyalty points have no cash value and may only be used for eligible rewards available through the platform.',
      },
    ],
  },
  {
    title: 'Vouchers & Promotions',
    items: [
      {
        question: 'How do I use a voucher?',
        answer:
          'Eligible vouchers or promotional offers may be applied during the checkout process.',
      },
      {
        question: 'Can I combine multiple vouchers or discounts?',
        answer:
          'This depends on the conditions of the promotion. Some vouchers or promotions may not be combined with other offers.',
      },
    ],
  },
];

export default function ChatSupport() {
  const [openItem, setOpenItem] = useState('0-0');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const visibleGroups = useMemo(() => {
    return faqGroups.filter((group) => {
      const categoryMatches = selectedCategory === 'All' || group.title === selectedCategory;
      if (!searchTerm.trim()) return categoryMatches;

      const query = searchTerm.toLowerCase();
      const matchesGroup = group.title.toLowerCase().includes(query);
      const matchesItem = group.items.some(
        (item) =>
          item.question.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query)
      );

      return categoryMatches && (matchesGroup || matchesItem);
    });
  }, [searchTerm, selectedCategory]);

  const toggleItem = (index) => {
    setOpenItem((prev) => (prev === index ? -1 : index));
  };

  const handleCategorySelect = (categoryLabel) => {
    setSelectedCategory(categoryLabel);
    setOpenItem('0-0');
    document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#fff4d8_0%,_#fffaf3_45%,_#fffaf3_100%)] px-3 py-5 sm:px-6 sm:py-8 md:px-10">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-[#f1e6d5] bg-white shadow-[0_18px_55px_rgba(92,66,35,0.09)]">
        <header className="border-b border-[#f1e6d5] bg-gradient-to-br from-[#fffdf8] via-white to-[#fff7e5] px-5 py-7 sm:px-8 sm:py-9 md:px-10">
          <div className="flex items-center gap-3">
            <img
              src={`${ROOT_BASE}/uploads/logo.png?v=logo-v2`}
              alt="Pastry Project logo"
              className="h-11 w-11 rounded-2xl bg-white p-1 object-contain shadow-sm ring-1 ring-[#f0e5d7]"
            />
            <div>
              <p className="text-xl tracking-tight"><BrandName /></p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#9b8060]">Sweetening moments</p>
            </div>
          </div>

          <p className="mt-7 inline-flex rounded-full border border-[#e8d39b] bg-[#fff8e4] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7424]">Help Center</p>
          <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-[#33251e] sm:text-4xl">
            How can we help you?
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#75675e] sm:text-base sm:leading-7">
            Find answers to common questions about orders, delivery, pickup, payments, customized cakes, rewards, and more.
          </p>
        </header>

        <div className="px-4 py-5 sm:px-8 sm:py-7 md:px-10">
          <div className="mb-7">
            <label htmlFor="help-search" className="sr-only">Search FAQs</label>
            <div className="flex items-center gap-3 rounded-2xl border border-[#eadfce] bg-[#fffdf8] px-4 py-3 shadow-sm transition focus-within:border-[#d4af37] focus-within:ring-2 focus-within:ring-[#d4af37]/15">
              <Search size={16} className="text-[#b18a23]" />
              <input
                id="help-search"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search questions or topics"
                className="w-full bg-transparent text-sm text-[#33251e] placeholder:text-[#9b8c83] focus:outline-none"
              />
            </div>
          </div>

          <section aria-labelledby="help-topics-heading">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id="help-topics-heading" className="text-lg font-black tracking-tight text-[#33251e]">Browse by topic</h2>
                <p className="mt-0.5 text-xs text-[#8b7a6d]">Choose a category to see related answers.</p>
              </div>
              <span className="hidden text-xs font-semibold text-[#a18a70] sm:block">7 topics</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {['All', ...categories.map((category) => category.label)].map((categoryLabel) => {
                const isActive = selectedCategory === categoryLabel;

                return (
                  <button
                    key={categoryLabel}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => handleCategorySelect(categoryLabel)}
                    className={`flex min-h-[58px] items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] ${
                      isActive
                        ? 'border-[#d4af37]/70 bg-[#fff8e4] text-[#6b4f1d] shadow-sm'
                        : 'border-[#f0e7dc] bg-white text-[#45382e] hover:border-[#d4af37]/50 hover:bg-[#fffdf8]'
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${isActive ? 'bg-white shadow-sm' : 'bg-[#faf5ec]'}`}>
                      {categoryLabel === 'All' ? '✨' : categories.find((category) => category.label === categoryLabel)?.icon}
                    </span>
                    <span className="leading-snug">{categoryLabel === 'All' ? 'All Topics' : categoryLabel}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section id="faq-section" aria-labelledby="faq-heading" className="mt-8 scroll-mt-6 border-t border-[#f1e8dc] pt-6 sm:mt-9 sm:pt-8">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#a17b2f]">Quick answers</p>
                <h2 id="faq-heading" className="mt-1 text-xl font-black tracking-tight text-[#33251e] sm:text-2xl">Frequently Asked Questions</h2>
              </div>
              {selectedCategory !== 'All' && (
                <span className="rounded-full border border-[#eadfce] bg-[#fffaf2] px-3 py-1 text-xs font-semibold text-[#7e674e]">{selectedCategory}</span>
              )}
            </div>

            <div className="space-y-4">
              {visibleGroups.length > 0 ? (
                visibleGroups.map((group, groupIndex) => (
                  <div key={group.title} className="rounded-2xl border border-[#f0e7dc] bg-[#fffdfa] p-3.5 sm:p-5">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#71552a] sm:text-base">
                      <span className="h-2 w-2 rounded-full bg-[#d4af37]" />
                      {group.title}
                    </h3>
                    <div className="space-y-3">
                      {group.items.map((item, itemIndex) => {
                        const actualIndex = `${groupIndex}-${itemIndex}`;
                        const isOpen = openItem === actualIndex;

                        return (
                          <div key={item.question} className={`overflow-hidden rounded-xl border transition-colors ${isOpen ? 'border-[#e8d39b] bg-white shadow-sm' : 'border-[#f0e9df] bg-white hover:border-[#e7d8be]'}`}>
                            <button
                              type="button"
                              onClick={() => toggleItem(actualIndex)}
                              aria-expanded={isOpen}
                              className="flex w-full items-center justify-between gap-4 px-3.5 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d4af37] sm:px-4"
                            >
                              <span className="text-[13px] font-semibold leading-5 text-[#33251e] sm:text-sm">{item.question}</span>
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 text-[#9a7424] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                              />
                            </button>

                            {isOpen && (
                              <div className="border-t border-[#f2e9db] bg-[#fffaf2] px-3.5 py-3 text-[13px] leading-6 text-[#6b5d52] sm:px-4 sm:text-sm sm:leading-7">
                                {item.answer}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[#e8d9bf] bg-[#fffdf8] p-6 text-center">
                  <p className="text-base font-semibold text-[#33251e]">No matching answers found.</p>
                  <p className="mt-2 text-sm text-[#817367]">Try another keyword or reset the filters.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('All');
                      setSearchTerm('');
                      setOpenItem('0-0');
                    }}
                    className="mt-4 rounded-full border border-[#e9d8ae] bg-[#fffaf0] px-4 py-2 text-sm font-bold text-[#6b4f1d] transition hover:bg-[#fff4d4]"
                  >
                    Reset filters
                  </button>
                </div>
              )}
            </div>
          </section>
          </div>
        </div>
    </main>
  );
}