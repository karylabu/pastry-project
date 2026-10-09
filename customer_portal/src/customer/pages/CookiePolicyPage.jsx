import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu as MenuIcon, X } from 'lucide-react';
import { ROOT_BASE } from '../../services/config';

const sections = [
  'Overview',
  '1. Cookies We Use',
  '2. Why These Cookies Are Used',
  '3. Browser Storage',
  '4. Third-Party Services',
  '5. Managing Cookies',
  '6. Data Retention and Security',
  '7. Changes to This Policy',
  '8. Contact Us',
];

export default function CookiePolicyPage() {
  const navigate = useNavigate();
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
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, []);

  return (
    <div className="cookie-page min-h-screen bg-[#fffaf3] text-[#1a1a1a]">
      <style>{`
        .cookie-page section { scroll-margin-top: 6rem; }
        .cookie-page .cookie-sidebar { width: 20rem; max-width: 100%; flex-shrink: 0; }
        .cookie-page .cookie-sidebar-item {
          font-size: 0.76rem;
          line-height: 1.3;
          padding: 0.3rem 0.55rem;
        }
        @media (max-width: 1023px) {
          .cookie-page .cookie-sidebar {
            width: auto;
            position: sticky;
            top: 4.5rem;
            align-self: start;
          }
          .cookie-page .cookie-sidebar-item {
            font-size: 0.65rem;
            line-height: 1.25;
            padding: 0.3rem 0.35rem;
          }
        }
      `}</style>
      <header className="sticky top-0 z-50 border-b border-[#f0e7cb] bg-[#fffdf9] backdrop-blur-sm">
        <div className="mx-auto flex max-w-[95rem] items-center justify-between px-3 py-3 sm:px-4 lg:px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/40 bg-[#fffaf0] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#171717] transition hover:border-[#d4af37] hover:bg-[#fdf3d7]"
            >
              ← Back
            </button>
            <div className="flex items-center gap-3">
              <img src={`${ROOT_BASE}/uploads/logo.png?v=logo-v2`} alt="Pastry Project logo" className="h-9 w-9 object-contain" />
              <p className="text-base font-black tracking-tight text-[#171717] sm:text-lg">Pastry Project</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[95rem] px-3 py-4 sm:px-4 lg:px-5">
        <div className={`${sectionsOpen ? 'grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-2' : 'grid grid-cols-1 gap-3'} items-start lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-4`}>
          <aside className="cookie-sidebar w-full lg:sticky lg:top-20 lg:w-[20rem] lg:self-start lg:justify-self-start">
            <button
              type="button"
              aria-expanded={sectionsOpen}
              aria-controls="cookie-sections-nav"
              onClick={() => setSectionsOpen((open) => !open)}
              className="mb-2 flex w-full items-center justify-between rounded-xl border border-[#d4af37]/35 bg-white/80 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-[0.14em] text-[#8d6a2e] shadow-sm lg:hidden"
            >
              <span>Sections</span>
              {sectionsOpen ? <X size={18} /> : <MenuIcon size={18} />}
            </button>
            <div className={`rounded-xl border border-[#d4af37]/35 bg-white/80 p-2 shadow-sm backdrop-blur-sm ${sectionsOpen ? 'block' : 'hidden lg:block'}`}>
              <p className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-[0.24em] text-[#b18a23]">Sections</p>
              <nav id="cookie-sections-nav" className="space-y-0.5 pr-1">
                {sections.map((section, index) => (
                  <a
                    key={section}
                    href={`#section-${index}`}
                    onClick={(event) => {
                      event.preventDefault();
                      setActiveSection(index);
                      document.getElementById(`section-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className={`cookie-sidebar-item block rounded-full border transition ${
                      activeSection === index
                        ? 'border-[#d4af37]/60 bg-[#fffaf0] font-semibold text-[#171717] shadow-sm'
                        : 'border-transparent text-gray-700 hover:border-[#d4af37]/40 hover:bg-[#fffaf0] hover:text-[#171717]'
                    }`}
                  >
                    {section}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <article className="w-full min-w-0 max-w-4xl">
            <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.24em] text-[#d4af37]">Pastry Project</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#171717]">Cookie Policy</h1>
            <p className="mt-1 text-[10px] font-medium text-gray-600">Last Updated: October 10, 2026</p>

            <div className="mt-4 space-y-5 text-sm leading-7 text-gray-700">
              <section id="section-0">
                <h2 className="text-base font-bold text-[#171717]">Overview</h2>
                <p className="mt-2">
                  This Cookie Policy explains how Pastry Project uses cookies and similar browser technologies when you
                  visit the website, sign in, and place or manage orders. We aim to describe the technologies used to
                  support the features currently available on the site.
                </p>
              </section>

              <section id="section-1">
                <h2 className="text-base font-bold text-[#171717]">1. Cookies We Use</h2>
                <p className="mt-2">
                  Pastry Project uses essential cookies needed for secure communication and account-related requests.
                  These include session and security-related cookies used by the Laravel application, such as its
                  session cookie and XSRF-TOKEN cookie when those features are active.
                </p>
                <p className="mt-2">
                  These cookies support functions such as keeping a request associated with the correct session and
                  helping protect actions that change account or order data. They are not used by us to build
                  advertising profiles.
                </p>
              </section>

              <section id="section-2">
                <h2 className="text-base font-bold text-[#171717]">2. Why These Cookies Are Used</h2>
                <p className="mt-2">Essential cookies and similar technologies help the website to:</p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Support sign-in and authenticated account features.</li>
                  <li>Protect forms and requests from cross-site request forgery.</li>
                  <li>Process account, checkout, and order-related actions reliably.</li>
                  <li>Maintain the technical operation and security of the service.</li>
                </ul>
                <p className="mt-2">
                  We do not currently use cookies for third-party advertising or cross-site behavioral advertising.
                </p>
              </section>

              <section id="section-3">
                <h2 className="text-base font-bold text-[#171717]">3. Browser Storage</h2>
                <p className="mt-2">
                  The website may also store information in your browser&apos;s local storage. Local storage is
                  different from a cookie and is used by the customer portal to retain app state, such as signed-in
                  account details and selected customer preferences, between page loads.
                </p>
                <p className="mt-2">
                  Clearing browser storage or signing out can remove locally stored information. Some features may then
                  require you to sign in again or restore your preferences.
                </p>
              </section>

              <section id="section-4">
                <h2 className="text-base font-bold text-[#171717]">4. Third-Party Services</h2>
                <p className="mt-2">
                  If you choose Google sign-in, Google and Firebase may process information and use their own
                  technologies to authenticate your account. Their handling of information is governed by their
                  respective privacy and cookie policies, which we do not control.
                </p>
                <p className="mt-2">
                  The website does not currently provide a third-party advertising cookie or analytics-cookie
                  preference category.
                </p>
              </section>

              <section id="section-5">
                <h2 className="text-base font-bold text-[#171717]">5. Managing Cookies</h2>
                <p className="mt-2">
                  You can review, block, or delete cookies through your browser settings. Browser controls vary by
                  browser and device. Blocking essential cookies may prevent sign-in, checkout, or other protected
                  features from working correctly.
                </p>
                <p className="mt-2">
                  Pastry Project does not currently provide a separate cookie-preference banner or settings panel.
                  Where browser controls allow, you can also clear this site&apos;s local storage; doing so may sign
                  you out or reset locally remembered information.
                </p>
              </section>

              <section id="section-6">
                <h2 className="text-base font-bold text-[#171717]">6. Data Retention and Security</h2>
                <p className="mt-2">
                  Session cookies generally remain for the duration of a browser session or according to the
                  application&apos;s configured session lifetime. Security cookies may remain until they expire or are
                  cleared. Exact behavior can depend on your browser and the current server configuration.
                </p>
                <p className="mt-2">
                  Cookies and browser storage should not be shared with other people using the same device. Sign out
                  when using a shared device and use the browser&apos;s controls to clear stored site data if needed.
                </p>
              </section>

              <section id="section-7">
                <h2 className="text-base font-bold text-[#171717]">7. Changes to This Policy</h2>
                <p className="mt-2">
                  We may update this Cookie Policy when the website&apos;s features or technologies change. The
                  updated date at the top of this page indicates when the policy was last revised.
                </p>
              </section>

              <section id="section-8">
                <h2 className="text-base font-bold text-[#171717]">8. Contact Us</h2>
                <p className="mt-2">
                  If you have questions about this policy or the website&apos;s use of browser technologies, contact
                  Pastry Project through the customer support features available on the website.
                </p>
              </section>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
