import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu as MenuIcon, X } from "lucide-react";
import { ROOT_BASE } from "../../services/config";
import BrandName from "../components/BrandName";

const sections = [
  "Overview",
  "When to Contact Us",
  "How to Report an Issue",
  "Review and Resolution",
  "Customized Cakes",
  "Contact Us",
];

export default function ReturnPolicyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const returnToCheckout = Boolean(location.state?.fromCheckout);
  const [activeSection, setActiveSection] = useState(0);
  const [sectionsOpen, setSectionsOpen] = useState(true);

  useEffect(() => {
    const updateActiveSection = () => {
      const sectionElements = [...document.querySelectorAll("section[id^='section-']")];
      const scrollY = window.scrollY + 220;
      let currentIndex = 0;

      sectionElements.forEach((section, index) => {
        if (section.offsetTop <= scrollY) currentIndex = index;
      });

      setActiveSection(currentIndex);
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, []);

  return (
    <div className="return-policy-page min-h-screen bg-[#fffaf3] text-[#1a1a1a]">
      <style>{`
        .return-policy-page section { scroll-margin-top: 6rem; }
        .return-policy-page .policy-sidebar { width: 20rem; max-width: 100%; flex-shrink: 0; }
        .return-policy-page .policy-sidebar-item {
          font-size: 0.76rem;
          line-height: 1.3;
          padding: 0.3rem 0.55rem;
        }
        @media (max-width: 1023px) {
          .return-policy-page .policy-sidebar {
            width: auto;
            position: sticky;
            top: 4.5rem;
            align-self: start;
          }
          .return-policy-page .policy-sidebar nav {
            max-height: calc(100dvh - 10rem);
            overflow-y: auto;
            overscroll-behavior-y: contain;
          }
          .return-policy-page .policy-sidebar-item {
            font-size: 0.65rem;
            line-height: 1.25;
            padding: 0.3rem 0.35rem;
          }
        }
      `}</style>
      <header className="sticky top-0 z-50 border-b border-[#f0e7cb] bg-[#fffdf9] backdrop-blur-sm">
        <div className="mx-auto flex max-w-[95rem] items-center justify-between px-3 py-3 sm:px-4 md:px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/40 bg-[#fffaf0] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#171717] transition hover:border-[#d4af37] hover:bg-[#fdf3d7]"
            >
              {returnToCheckout ? "← Back to Checkout" : "← Back"}
            </button>
            <div className="flex items-center gap-3">
              <img src={`${ROOT_BASE}/uploads/logo.png?v=logo-v2`} alt="Pastry Project logo" className="h-9 w-9 object-contain" />
              <p className="text-base tracking-tight sm:text-lg"><BrandName /></p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[95rem] px-3 py-4 sm:px-4 md:px-5">
        <div className={`${sectionsOpen ? "grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-2" : "grid grid-cols-1 gap-3"} items-start md:grid-cols-[20rem_minmax(0,1fr)] md:gap-4`}>
          <aside className="policy-sidebar w-full md:sticky md:top-20 md:w-[20rem] md:self-start md:justify-self-start">
            <button
              type="button"
              aria-expanded={sectionsOpen}
              aria-controls="return-policy-sections"
              onClick={() => setSectionsOpen((open) => !open)}
              className="mb-2 flex w-full items-center justify-between rounded-xl border border-[#d4af37]/35 bg-white/80 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-[0.14em] text-[#8d6a2e] shadow-sm md:hidden"
            >
              <span>Sections</span>
              {sectionsOpen ? <X size={18} /> : <MenuIcon size={18} />}
            </button>
            <div className={`rounded-xl border border-[#d4af37]/35 bg-white/80 p-2 shadow-sm backdrop-blur-sm ${sectionsOpen ? "block" : "hidden md:block"}`}>
              <p className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-[0.24em] text-[#b18a23]">Sections</p>
              <nav id="return-policy-sections" className="space-y-0.5 pr-1">
                {sections.map((section, index) => (
                  <a
                    key={section}
                    href={`#section-${index}`}
                    onClick={(event) => {
                      event.preventDefault();
                      setActiveSection(index);
                      document.getElementById(`section-${index}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={`policy-sidebar-item block rounded-full border transition ${
                      activeSection === index
                        ? "border-[#d4af37]/60 bg-[#fffaf0] font-semibold text-[#171717] shadow-sm"
                        : "border-transparent text-gray-700 hover:border-[#d4af37]/40 hover:bg-[#fffaf0] hover:text-[#171717]"
                    }`}
                  >
                    {index === 0 ? section : `${index}. ${section}`}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <article className="w-full min-w-0 max-w-4xl">
            <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.24em] text-[#d4af37]">Pastry Project</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#171717]">Return Policy</h1>
            <p className="mt-1 text-[10px] font-medium text-gray-600">Last Updated: October 21, 2026</p>

            <div className="mt-4 space-y-5 text-sm leading-7 text-gray-700">
              <section id="section-0">
                <h2 className="text-base font-bold text-[#171717]">Overview</h2>
                <p className="mt-2">
                  All cakes sold on Pastry Project are perishable and made-to-order. Therefore, we generally do not
                  accept returns or offer refunds once the order has been accepted by the customer (via pickup or
                  delivery).
                </p>
                <p className="mt-2">
                  Once the cake leaves our shop or is handed over to the delivery courier, the responsibility for its
                  condition transfers to the customer/courier.
                </p>
                <p className="mt-2">
                  This policy does not limit any rights you may have under applicable Philippine consumer-protection
                  laws.
                </p>
              </section>

              <section id="section-1">
                <h2 className="text-base font-bold text-[#171717]">1. When to Contact Us</h2>
                <p className="mt-2">
                  Please contact us if your order is incorrect, arrives damaged, or has a product-quality concern.
                  Because our products are perishable, let us know promptly after pickup or delivery so we can assess
                  the issue while the details are still clear.
                </p>
                <p className="mt-2">
                  Because orders are perishable and made-to-order, we generally do not accept returns or offer refunds
                  after an order has been accepted. We review concerns about incorrect, damaged, or poor-quality orders
                  individually, subject to applicable consumer-protection laws.
                </p>
              </section>

              <section id="section-2">
                <h2 className="text-base font-bold text-[#171717]">2. How to Report an Issue</h2>
                <p className="mt-2">Contact us through the Help Center or the contact details below and include:</p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Your order number and the name used for the order.</li>
                  <li>A short description of the issue and when you noticed it.</li>
                  <li>Clear photos, if the concern involves the item or its packaging.</li>
                </ul>
                <p className="mt-2">
                  If possible, keep the affected item and packaging until we respond, so we can better understand the
                  concern.
                </p>
              </section>

              <section id="section-3">
                <h2 className="text-base font-bold text-[#171717]">3. Review and Resolution</h2>
                <p className="mt-2">
                  Our team may ask for more information before deciding how to address a concern. Depending on the
                  circumstances and applicable requirements, a resolution may include a replacement, refund, or
                  another appropriate solution.
                </p>
                <p className="mt-2">
                  Sending a report does not automatically approve a return or refund. We will review the information
                  and communicate the outcome with you.
                </p>
              </section>

              <section id="section-4">
                <h2 className="text-base font-bold text-[#171717]">4. Customized Cakes</h2>
                <p className="mt-2">
                  Customized cakes are prepared to the specifications confirmed for your order. If the finished cake
                  does not match the confirmed order or has a quality issue, contact us promptly with your order
                  number and photos so we can review it.
                </p>
                <p className="mt-2">
                  Changes in design preference after preparation are not the same as an incorrect or damaged order.
                  Any concern is assessed individually, subject to your applicable consumer rights.
                </p>
              </section>

              <section id="section-5">
                <h2 className="text-base font-bold text-[#171717]">5. Contact Us</h2>
                <p className="mt-2">
                  For help with an order, use the website Help Center or contact Pastry Project at
                  {" "}<a className="font-semibold text-[#8d6a2e] underline" href="mailto:pastryproject.bc@gmail.com">pastryproject.bc@gmail.com</a>
                  {" "}or 0938-796-2033.
                </p>
              </section>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
