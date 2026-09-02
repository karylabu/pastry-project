import React, { useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Search, MessageCircleMore } from 'lucide-react';

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
  const [openItem, setOpenItem] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);

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

  const handleSearchFocus = () => {
    searchInputRef.current?.focus();
    searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSupportAction = () => {
    setSelectedCategory('All');
    setSearchTerm('');
    setOpenItem(0);
    document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => searchInputRef.current?.focus(), 250);
  };

  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl bg-white">
        <div className="border-b border-[#f0e6db] px-5 py-7 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <img
              src="http://localhost/pastry-project/uploads/logo.png?v=logo-v2"
              alt="Pastry Project logo"
              className="h-11 w-11 rounded-none bg-transparent object-contain"
            />
            <div>
              <p className="text-xl font-black tracking-tight text-[#171717]">Pastry Project</p>
            </div>
          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-[#b18a23]">Help Center</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-[#171717] sm:text-4xl">
            Hi! How can we help you? 👋
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600">
            Find answers to common questions about orders, delivery, pickup, payments, customized cakes, rewards, and more.
          </p>

        </div>

        <div className="px-5 py-6 sm:px-8 lg:px-10">
          <div className="mb-5">
            <label htmlFor="help-search" className="sr-only">Search FAQs</label>
            <div className="flex items-center gap-3 rounded-2xl border border-[#f0e5d7] bg-[#fffdf8] px-3 py-3 shadow-sm">
              <Search size={16} className="text-[#b18a23]" />
              <input
                id="help-search"
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search FAQs or topics"
                className="w-full bg-transparent text-sm text-[#171717] placeholder:text-gray-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {['All', ...categories.map((category) => category.label)].map((categoryLabel) => {
              const isActive = selectedCategory === categoryLabel;

              return (
                <button
                  key={categoryLabel}
                  type="button"
                  onClick={() => setSelectedCategory(categoryLabel)}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                    isActive
                      ? 'border-[#d4af37]/60 bg-[#fffaf0] text-[#171717] shadow-sm'
                      : 'border-[#f1e5d2] bg-[#fffdf8] text-[#171717] hover:border-[#d4af37]/40 hover:bg-[#fffaf0]'
                  }`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f8f1e2] text-base">
                    {categoryLabel === 'All' ? '✨' : categories.find((category) => category.label === categoryLabel)?.icon}
                  </span>
                  {categoryLabel === 'All' ? 'All Topics' : categoryLabel}
                </button>
              );
            })}
          </div>

          <div id="faq-section" className="mt-8 border-t border-[#f3eadf] pt-8">
            <h2 className="text-2xl font-black tracking-tight text-[#171717]">Frequently Asked Questions</h2>

            <div className="mt-6 space-y-4">
              {visibleGroups.length > 0 ? (
                visibleGroups.map((group, groupIndex) => (
                  <div key={group.title} className="rounded-[22px] border border-[#f0e7dc] bg-[#fffdfb] p-4 sm:p-5">
                    <h3 className="mb-3 text-lg font-black text-[#171717]">{group.title}</h3>
                    <div className="space-y-3">
                      {group.items.map((item, itemIndex) => {
                        const actualIndex = `${groupIndex}-${itemIndex}`;
                        const isOpen = openItem === actualIndex;

                        return (
                          <div key={item.question} className="overflow-hidden rounded-2xl border border-[#f0e5d7] bg-white">
                            <button
                              type="button"
                              onClick={() => toggleItem(actualIndex)}
                              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                            >
                              <span className="text-sm font-semibold text-[#171717] sm:text-base">{item.question}</span>
                              <ChevronDown
                                className={`h-5 w-5 shrink-0 text-[#171717] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                              />
                            </button>

                            {isOpen && (
                              <div className="border-t border-[#f3ebdf] bg-[#fffaf2] px-4 py-3 text-sm leading-7 text-gray-700">
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
                <div className="rounded-[22px] border border-dashed border-[#f0e5d7] bg-[#fffdf8] p-6 text-center">
                  <p className="text-base font-semibold text-[#171717]">No matching answers found.</p>
                  <p className="mt-2 text-sm text-gray-600">Try another keyword or reset the filters.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('All');
                      setSearchTerm('');
                    }}
                    className="mt-4 rounded-full border border-[#e9d8ae] bg-[#fffaf0] px-4 py-2 text-sm font-bold text-[#171717]"
                  >
                    Reset filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}