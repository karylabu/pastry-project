import React, { useEffect, useState } from "react";

const sections = [
  "Overview",
  "1. The Services We Provide",
  "2. Customer Accounts",
  "3. Orders and Product Availability",
  "4. Pricing and Payments",
  "5. Delivery Services",
  "6. Pickup Orders",
  "7. Customized Cakes and Products",
  "8. Order Changes and Cancellations",
  "9. Refunds and Order Concerns",
  "10. Loyalty Points and Rewards",
  "11. Vouchers, Discounts, and Promotions",
  "12. Product Information and Food Allergies",
  "13. Customer Responsibilities",
  "14. Use of the Website",
  "15. Intellectual Property",
  "16. Privacy and Personal Information",
  "17. Platform Availability and Technical Issues",
  "18. Limitation of Liability",
  "19. Suspension or Termination of Access",
  "20. Changes to These Terms and Conditions",
  "21. Contact Us",
];

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    const updateActiveSection = () => {
      const sectionsList = [...document.querySelectorAll("section[id^='section-']")];
      if (!sectionsList.length) return;

      const scrollY = window.scrollY + 220;
      let currentIndex = 0;

      sectionsList.forEach((section, index) => {
        if (section.offsetTop <= scrollY) {
          currentIndex = index;
        }
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
    <div className="min-h-screen bg-white text-[#1a1a1a]">
      <header className="border-b border-[#f0e7cb] bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <img src="/assets/logo-transparent.png" alt="Pastry Project logo" className="h-11 w-11 rounded-none bg-transparent object-contain" />
            <div>
              <p className="text-xl font-black tracking-tight text-[#171717]">Pastry Project</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <aside className="w-full lg:w-[22rem] lg:self-start">
            <div className="rounded-2xl border border-[#d4af37]/35 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#b18a23]">Sections</p>
              <nav className="mt-3 space-y-2 pr-1">
                {sections.map((section, index) => {
                  const isActive = activeSection === index;

                  return (
                    <a
                      key={section}
                      href={`#section-${index}`}
                      onClick={() => setActiveSection(index)}
                      className={`block rounded-xl border px-2 py-1.5 text-sm transition ${
                        isActive
                          ? "border-[#d4af37]/60 bg-[#fffaf0] font-semibold text-[#171717] shadow-sm"
                          : "border-transparent text-gray-700 hover:border-[#d4af37]/40 hover:bg-[#fffaf0] hover:text-[#171717]"
                      }`}
                    >
                      {section}
                    </a>
                  );
                })}
              </nav>
            </div>
          </aside>

          <div className="w-full max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[#d4af37]">Terms &amp; Conditions</p>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Terms and Conditions</h1>
            <p className="mt-3 text-sm font-medium text-gray-600">Last Updated: August 29, 2026</p>

            <div className="mt-4 space-y-8">
          <section id="section-0">
            <h2 className="text-xl font-bold text-[#171717]">Overview</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Welcome to <span className="font-semibold text-[#171717]">Pastry Project</span>. These Terms and
              Conditions (&ldquo;Terms&rdquo;) govern your access to and use of the Pastry Project website, including
              its products, ordering system, account features, customized orders, delivery and pickup services,
              loyalty rewards, vouchers, and other services provided through the platform.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              By accessing, browsing, creating an account, or placing an order through Pastry Project, you agree to
              comply with and be bound by these Terms and Conditions. If you do not agree with any part of these
              Terms, you should not access or use our website or services.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              These Terms form an agreement between you and Pastry Project regarding your use of our platform and
              services.
            </p>
          </section>

          <section id="section-1">
            <h2 className="text-xl font-bold text-[#171717]">1. The Services We Provide</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project provides an online platform where customers may browse available products, place orders,
              customize selected products, choose delivery or pickup options, manage their accounts, receive order
              updates, and access loyalty rewards and promotional offers.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Our services may include features such as:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Browsing pastry and bakery products.</li>
              <li>Placing orders online.</li>
              <li>Selecting delivery or pickup.</li>
              <li>Requesting customized cakes and selected products.</li>
              <li>Viewing and managing order information.</li>
              <li>Earning and redeeming loyalty points.</li>
              <li>Using eligible vouchers, promotions, and discounts.</li>
              <li>Communicating with customer support through available platform features.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              We may update, modify, add, suspend, or remove features from the platform when necessary to improve our
              services, maintain security, or ensure the proper operation of the website.
            </p>
          </section>

          <section id="section-2">
            <h2 className="text-xl font-bold text-[#171717]">2. Customer Accounts</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Certain features of Pastry Project may require you to create and maintain a customer account.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              When creating an account, you agree to provide accurate, complete, and up-to-date information. You are
              responsible for maintaining the confidentiality of your account credentials and for activities performed
              through your account.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">You agree not to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Provide false or misleading information.</li>
              <li>Create an account using another person&apos;s identity without permission.</li>
              <li>Share your account password with unauthorized individuals.</li>
              <li>Attempt to access another customer&apos;s account.</li>
              <li>Use the platform for fraudulent or unlawful purposes.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project may suspend or restrict access to an account if we reasonably believe that the account is
              being used in violation of these Terms or in a manner that may affect the security or operation of the
              platform.
            </p>
          </section>

          <section id="section-3">
            <h2 className="text-xl font-bold text-[#171717]">3. Orders and Product Availability</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers may place orders through the Pastry Project website, subject to product availability and order
              confirmation.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              We make reasonable efforts to ensure that product descriptions, prices, images, and availability
              displayed on the website are accurate. However, products may become unavailable, and certain items may
              require additional preparation time.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project reserves the right to:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Limit the quantity of products available for purchase.</li>
              <li>Modify or update product availability.</li>
              <li>Decline or cancel an order when necessary.</li>
              <li>Contact the customer regarding unavailable products or order concerns.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              An order may be considered accepted only after the required ordering and confirmation processes have been
              completed.
            </p>
          </section>

          <section id="section-4">
            <h2 className="text-xl font-bold text-[#171717]">4. Pricing and Payments</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Product prices are displayed on the website and may be updated when necessary. The final amount payable by
              the customer will be shown during the checkout process.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers are responsible for providing accurate payment information and selecting a valid payment method
              available through the platform.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Depending on the selected payment method, an order may require payment confirmation before it is
              processed.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project may delay, suspend, or cancel an order if:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Payment cannot be successfully verified or processed.</li>
              <li>The payment information provided is incomplete or invalid.</li>
              <li>The transaction appears to be unauthorized or fraudulent.</li>
              <li>There is a technical issue affecting payment processing.</li>
            </ul>
          </section>

          <section id="section-5">
            <h2 className="text-xl font-bold text-[#171717]">5. Delivery Services</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers who select delivery are responsible for providing an accurate and complete delivery address and
              valid contact information.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Estimated delivery times may vary depending on several factors, including:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Customer location.</li>
              <li>Distance from the store.</li>
              <li>Traffic conditions.</li>
              <li>Weather conditions.</li>
              <li>Order volume.</li>
              <li>Product preparation time.</li>
              <li>Other circumstances beyond reasonable control.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project will make reasonable efforts to process and deliver orders within the expected timeframe.
              However, delivery times may change due to circumstances that affect preparation or transportation.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers are encouraged to remain available at the provided contact number during the expected delivery
              period.
            </p>
          </section>

          <section id="section-6">
            <h2 className="text-xl font-bold text-[#171717]">6. Pickup Orders</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers who select pickup are responsible for collecting their orders at the selected or agreed pickup
              time.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers should review their order details before leaving the pickup location. Pastry Project may not be
              responsible for issues reported after the product has been accepted, except where required by applicable
              policies or circumstances.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Orders that are not collected within a reasonable period may be subject to additional handling or
              cancellation procedures.
            </p>
          </section>

          <section id="section-7">
            <h2 className="text-xl font-bold text-[#171717]">7. Customized Cakes and Products</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project may allow customers to request customized cakes and selected products through the platform.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customized orders may require information such as:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Preferred product or cake design.</li>
              <li>Flavor selection.</li>
              <li>Size.</li>
              <li>Color preferences.</li>
              <li>Personalized messages.</li>
              <li>Preferred pickup or delivery date.</li>
              <li>Reference images, when applicable.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers are responsible for ensuring that all customization details submitted are accurate before the
              order is confirmed.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Because customized products require preparation based on customer specifications, changes may be limited
              once preparation has started. Pastry Project cannot guarantee that a customized product will exactly match
              a reference image, especially when certain ingredients, decorations, colors, or materials are unavailable.
            </p>
          </section>

          <section id="section-8">
            <h2 className="text-xl font-bold text-[#171717]">8. Order Changes and Cancellations</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers may request changes or cancellations subject to the status of the order.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              An order may no longer be eligible for cancellation or modification if:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Preparation has already started.</li>
              <li>The product has already been completed.</li>
              <li>A customized product has entered the production process.</li>
              <li>The order has already been transferred for delivery.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project will review cancellation or modification requests based on the circumstances and current
              status of the order.
            </p>
          </section>

          <section id="section-9">
            <h2 className="text-xl font-bold text-[#171717]">9. Refunds and Order Concerns</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers who experience concerns regarding an order may contact Pastry Project through the available
              contact or customer support features.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Refund eligibility may depend on factors such as:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Incorrect or missing products.</li>
              <li>Product quality concerns.</li>
              <li>Incorrect order fulfillment.</li>
              <li>Payment issues.</li>
              <li>Other circumstances related to the order.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Refunds, replacements, or other appropriate resolutions will be reviewed based on the specific
              circumstances of the concern.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customized or personalized products may have different refund eligibility due to the nature of their
              preparation.
            </p>
          </section>

          <section id="section-10">
            <h2 className="text-xl font-bold text-[#171717]">10. Loyalty Points and Rewards</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Eligible customers may earn loyalty points through completed orders based on the rules of the Pastry
              Project Loyalty Rewards Program.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Loyalty points may be used to redeem eligible rewards displayed on the platform.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">Unless otherwise stated:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Points are earned only from eligible completed orders.</li>
              <li>Points have no cash value.</li>
              <li>Points cannot be sold, transferred, or exchanged for cash.</li>
              <li>Rewards may require a specific number of points.</li>
              <li>Redeemed points may be deducted from the customer&apos;s available balance.</li>
              <li>Eligibility requirements may apply to specific rewards.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project may update, modify, suspend, or discontinue the loyalty rewards program when necessary.
            </p>
          </section>

          <section id="section-11">
            <h2 className="text-xl font-bold text-[#171717]">11. Vouchers, Discounts, and Promotions</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project may offer vouchers, promotional discounts, free delivery offers, and other promotional
              benefits.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Each promotion may have specific conditions, including:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Eligibility requirements.</li>
              <li>Minimum order amounts.</li>
              <li>Expiration dates.</li>
              <li>Usage limitations.</li>
              <li>Applicable products or services.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Unless otherwise stated, promotions and vouchers may not be combined with other offers.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project reserves the right to modify, suspend, or discontinue promotions when necessary.
            </p>
          </section>

          <section id="section-12">
            <h2 className="text-xl font-bold text-[#171717]">12. Product Information and Food Allergies</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              We make reasonable efforts to provide accurate product descriptions and information through the website.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers are encouraged to review available product information before placing an order.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Some products may contain ingredients that can cause allergic reactions or may be prepared in
              environments where allergens are present.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers with food allergies, dietary restrictions, or ingredient concerns should contact Pastry Project
              before placing an order to obtain additional information where available.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers are responsible for informing us of relevant product concerns before confirming an order.
            </p>
          </section>

          <section id="section-13">
            <h2 className="text-xl font-bold text-[#171717]">13. Customer Responsibilities</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              When using Pastry Project, you agree to use the platform responsibly and lawfully.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">You agree not to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Use the website for fraudulent purposes.</li>
              <li>Provide false information when placing an order.</li>
              <li>Attempt unauthorized access to accounts or system features.</li>
              <li>Interfere with the security or proper operation of the website.</li>
              <li>Upload malicious software, viruses, or harmful code.</li>
              <li>Abuse customer support or communication features.</li>
              <li>Use another person&apos;s account or personal information without permission.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              We may take appropriate action when we determine that a user has violated these Terms.
            </p>
          </section>

          <section id="section-14">
            <h2 className="text-xl font-bold text-[#171717]">14. Use of the Website</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              The Pastry Project website and its features are provided to help customers access our products and
              services.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">You may not attempt to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Copy or exploit the website for unauthorized commercial purposes.</li>
              <li>Reverse engineer or interfere with the operation of the system.</li>
              <li>Access restricted areas without authorization.</li>
              <li>Collect customer or system information without permission.</li>
              <li>Circumvent security measures implemented by the platform.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Unauthorized use of the platform may result in restricted or terminated access.
            </p>
          </section>

          <section id="section-15">
            <h2 className="text-xl font-bold text-[#171717]">15. Intellectual Property</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              The content available on Pastry Project, including but not limited to the website design, branding,
              logo, text, graphics, product images, interface elements, and other materials, may be protected by
              applicable intellectual property rights.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers may use the website for personal and lawful ordering purposes.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              You may not copy, reproduce, distribute, modify, or use Pastry Project content for commercial purposes
              without appropriate permission.
            </p>
          </section>

          <section id="section-16">
            <h2 className="text-xl font-bold text-[#171717]">16. Privacy and Personal Information</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Your use of Pastry Project may involve the collection and processing of certain information necessary to
              provide our services.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              This may include information used for:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Account registration.</li>
              <li>Order processing.</li>
              <li>Payment processing.</li>
              <li>Delivery coordination.</li>
              <li>Customer communication.</li>
              <li>Loyalty rewards.</li>
              <li>Website improvement and security.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              We will handle customer information in accordance with the applicable privacy practices of the platform.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers should provide accurate information necessary for us to process and fulfill orders.
            </p>
          </section>

          <section id="section-17">
            <h2 className="text-xl font-bold text-[#171717]">17. Platform Availability and Technical Issues</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              We make reasonable efforts to maintain the availability and proper operation of the Pastry Project
              website.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              However, we cannot guarantee that the platform will always be available, uninterrupted, secure, or free
              from technical issues.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              The website may occasionally experience:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Maintenance periods.</li>
              <li>System updates.</li>
              <li>Technical errors.</li>
              <li>Internet connectivity issues.</li>
              <li>Temporary service interruptions.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project may temporarily suspend certain features when necessary to perform maintenance, updates,
              or security improvements.
            </p>
          </section>

          <section id="section-18">
            <h2 className="text-xl font-bold text-[#171717]">18. Limitation of Liability</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project shall not be liable for any indirect, incidental, consequential, special, or punitive
              damages arising out of or related to the use of the website or services, including but not limited to
              losses related to order delays, product dissatisfaction, business interruptions, or loss of information.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              To the fullest extent permitted by applicable law, our total liability in relation to any order or use of
              the website shall not exceed the amount actually paid for the relevant product or service, except where
              required by applicable law.
            </p>
          </section>

          <section id="section-19">
            <h2 className="text-xl font-bold text-[#171717]">19. Suspension or Termination of Access</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project may suspend, restrict, or terminate access to the website or certain services when
              necessary to protect the security, integrity, or proper operation of the platform.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              We may take such action if a customer violates these Terms, misuses the platform, engages in fraudulent
              or unauthorized conduct, or otherwise creates risk for the website, other customers, or Pastry Project.
            </p>
          </section>

          <section id="section-20">
            <h2 className="text-xl font-bold text-[#171717]">20. Changes to These Terms and Conditions</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project may update or revise these Terms and Conditions from time to time to reflect changes in
              our services, legal requirements, operational processes, or business practices.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Continued use of the website after the publication of updated Terms indicates your acceptance of those
              changes. If you do not agree with the revised Terms, you should stop using the website and related
              services.
            </p>
          </section>

          <section id="section-21">
            <h2 className="text-xl font-bold text-[#171717]">21. Contact Us</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              If you have questions, concerns, or requests regarding these Terms and Conditions, the website, or any
              order-related issue, you may contact Pastry Project through the available support or contact channels on
              the platform.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              We encourage customers to reach out as soon as possible if they need clarification or support regarding an
              order, account, policy matter, or any concern related to the website.
            </p>
          </section>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
