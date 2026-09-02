import React, { useEffect, useState } from "react";

const sections = [
  "1. Information We Collect",
  "2. How We Use Your Information",
  "3. How We Share Information",
  "4. How We Protect Your Information",
  "5. Data Retention",
  "6. Cookies and Similar Technologies",
  "7. Your Privacy Choices and Rights",
  "8. Account Information and Security",
  "9. Loyalty Points and Privacy",
  "10. Customized Orders and Uploaded Content",
  "11. Children's Privacy",
  "12. Third-Party Services",
  "13. Compliance with the Data Privacy Act of 2012",
  "14. Changes to This Privacy Policy",
  "15. Contact Us",
];

export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    const updateActiveSection = () => {
      const sectionElements = [...document.querySelectorAll("section[id^='section-']")];
      if (!sectionElements.length) return;

      const scrollY = window.scrollY + 220;
      let currentIndex = 0;

      sectionElements.forEach((section, index) => {
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
            <img src="http://localhost/pastry-project/uploads/logo.png?v=logo-v2" alt="Pastry Project logo" className="h-11 w-11 rounded-none bg-transparent object-contain" />
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
                      href={`#section-${index + 1}`}
                      onClick={() => setActiveSection(index)}
                      className={`block rounded-xl border px-2 py-1.5 text-sm transition ${
                        isActive
                          ? "border-[#d4af37]/60 bg-[#fffaf0] font-semibold text-[#171717] shadow-sm"
                          : "border-transparent text-gray-700 hover:border-[#d4af37]/40 hover:bg-[#fffaf0] hover:text-[#171717]"
                      }`}
                    >
                      <span className="mr-2 inline-block w-5 text-right text-[#b18a23]">{index + 1}.</span>
                      {section.replace(/^\d+\.\s*/, "")}
                    </a>
                  );
                })}
              </nav>
            </div>
          </aside>

          <div className="w-full max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[#d4af37]">Privacy Policy</p>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Privacy Policy</h1>
            <p className="mt-3 text-sm font-medium text-gray-600">Last Updated: August 29, 2026</p>

            <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-[#171717]">Overview</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Welcome to <span className="font-semibold text-[#171717]">Pastry Project</span>. We value your privacy
              and are committed to protecting the personal information you provide when using our website and services.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              This Privacy Policy explains how Pastry Project may collect, use, store, protect, and manage information
              when you access or use our website, create an account, place an order, request customized products,
              select delivery or pickup, participate in our loyalty rewards program, or communicate with us through
              available features.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              By accessing or using Pastry Project, you acknowledge that your information may be collected and processed
              as described in this Privacy Policy.
            </p>
          </section>

          <section id="section-1">
            <h2 className="text-xl font-bold text-[#171717]">1. Information We Collect</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              We may collect information necessary to provide, operate, and improve our products and services.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">The information we collect may include the following:</p>

            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-[#171717]">1.1 Account Information</h3>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  When you create an account, we may collect information such as:
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
                  <li>Full name</li>
                  <li>Email address</li>
                  <li>Mobile or contact number</li>
                  <li>Username or account information</li>
                  <li>Password in securely protected form</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#171717]">1.2 Order Information</h3>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  When you place an order, we may collect information related to your transaction, including:
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
                  <li>Products ordered</li>
                  <li>Order quantity</li>
                  <li>Selected product options</li>
                  <li>Customized product details</li>
                  <li>Order date and time</li>
                  <li>Selected delivery or pickup option</li>
                  <li>Order status</li>
                  <li>Payment method</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#171717]">1.3 Delivery Information</h3>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  If you choose delivery, we may collect information necessary to fulfill your order, including:
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
                  <li>Delivery address</li>
                  <li>Recipient name</li>
                  <li>Contact number</li>
                  <li>Delivery instructions, when provided</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#171717]">1.4 Customized Order Information</h3>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  For customized cakes and other personalized products, we may collect information such as:
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
                  <li>Preferred design</li>
                  <li>Flavor</li>
                  <li>Size</li>
                  <li>Colors or decoration preferences</li>
                  <li>Personalized messages</li>
                  <li>Reference images</li>
                  <li>Preferred date</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#171717]">1.5 Payment Information</h3>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  Payment information may be processed depending on the payment method available through the platform.
                </p>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  Pastry Project may collect information necessary to confirm and manage a transaction. Where
                  third-party payment providers are used, payment processing may also be subject to the privacy
                  practices and policies of the applicable provider.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#171717]">1.6 Loyalty and Rewards Information</h3>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  If you participate in the Pastry Project Loyalty Rewards Program, we may maintain information related
                  to:
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
                  <li>Loyalty points earned</li>
                  <li>Loyalty points redeemed</li>
                  <li>Available rewards</li>
                  <li>Reward redemption history</li>
                  <li>Eligible completed orders</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#171717]">1.7 Communications</h3>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  When you contact Pastry Project through customer support, chat features, contact forms, or other
                  available communication channels, we may collect the information you provide, including:
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
                  <li>Messages</li>
                  <li>Questions or concerns</li>
                  <li>Feedback</li>
                  <li>Information related to your order</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="section-2">
            <h2 className="text-xl font-bold text-[#171717]">2. How We Use Your Information</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              We may use collected information for purposes necessary to operate and improve Pastry Project.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-[#171717]">2.1 Providing Our Services</h3>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  We may use your information to:
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
                  <li>Create and manage customer accounts.</li>
                  <li>Process and confirm orders.</li>
                  <li>Prepare products.</li>
                  <li>Coordinate delivery or pickup.</li>
                  <li>Provide customized products.</li>
                  <li>Manage loyalty points and rewards.</li>
                  <li>Respond to customer inquiries.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#171717]">2.2 Processing and Managing Orders</h3>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  Information may be used to verify, process, prepare, and complete customer orders.
                </p>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  We may also use order information to provide updates regarding order status, preparation, delivery,
                  pickup, or other important transaction-related information.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#171717]">2.3 Improving Our Services</h3>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  We may review information about how customers use the platform to help us:
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
                  <li>Improve website features.</li>
                  <li>Improve product and service offerings.</li>
                  <li>Identify technical problems.</li>
                  <li>Improve customer experience.</li>
                  <li>Maintain and develop platform features.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#171717]">2.4 Communication</h3>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  We may use your contact information to communicate with you regarding:
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
                  <li>Order confirmations.</li>
                  <li>Order updates.</li>
                  <li>Delivery or pickup coordination.</li>
                  <li>Customer support requests.</li>
                  <li>Important changes to our services or policies.</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="section-3">
            <h2 className="text-xl font-bold text-[#171717]">3. How We Share Information</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project does not sell personal information to third parties.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              We may share limited information only when necessary to provide our services.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-[#171717]">3.1 Delivery Personnel or Delivery Partners</h3>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  Information necessary to complete a delivery may be provided to authorized delivery personnel or
                  delivery partners.
                </p>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  This may include:
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
                  <li>Customer name</li>
                  <li>Delivery address</li>
                  <li>Contact information</li>
                  <li>Relevant delivery instructions</li>
                </ul>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  Only information necessary to complete the delivery should be shared.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#171717]">3.2 Payment Service Providers</h3>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  Where applicable, payment-related information may be processed through authorized payment service
                  providers.
                </p>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  The collection and processing of information by these providers may also be subject to their own
                  privacy policies.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#171717]">3.3 Service Providers</h3>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  We may use authorized service providers to support functions necessary for operating Pastry Project.
                </p>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  These services may include:
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
                  <li>Website hosting</li>
                  <li>System maintenance</li>
                  <li>Email or notification services</li>
                  <li>Payment processing</li>
                  <li>Delivery coordination</li>
                </ul>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  Information shared with service providers should be limited to what is reasonably necessary to provide
                  the relevant service.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#171717]">3.4 Legal and Security Requirements</h3>
                <p className="mt-2 text-base leading-8 text-gray-700">
                  Information may be disclosed when reasonably necessary to:
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
                  <li>Comply with applicable legal requirements.</li>
                  <li>Respond to lawful requests.</li>
                  <li>Protect the rights, safety, and security of Pastry Project and its users.</li>
                  <li>Investigate suspected fraud or misuse of the platform.</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="section-4">
            <h2 className="text-xl font-bold text-[#171717]">4. How We Protect Your Information</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project takes reasonable measures to protect personal information from unauthorized access, loss,
              misuse, alteration, or disclosure.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">Security measures may include:</p>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Account authentication.</li>
              <li>Password protection.</li>
              <li>Access controls.</li>
              <li>Secure handling of customer information.</li>
              <li>System monitoring and maintenance.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              However, no online platform or method of electronic storage can guarantee complete security. Customers are
              encouraged to protect their account credentials and avoid sharing passwords with others.
            </p>
          </section>

          <section id="section-5">
            <h2 className="text-xl font-bold text-[#171717]">5. Data Retention</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              We may retain personal and transaction-related information for as long as reasonably necessary to:
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Provide our services.</li>
              <li>Maintain customer accounts.</li>
              <li>Process and manage orders.</li>
              <li>Maintain order history.</li>
              <li>Manage loyalty rewards.</li>
              <li>Resolve customer concerns.</li>
              <li>Maintain security and system integrity.</li>
              <li>Meet applicable legal or operational requirements.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Information that is no longer reasonably necessary may be deleted or securely managed according to our data
              management practices.
            </p>
          </section>

          <section id="section-6">
            <h2 className="text-xl font-bold text-[#171717]">6. Cookies and Similar Technologies</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project may use cookies or similar technologies to support the proper operation of the website.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">These technologies may help us:</p>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Maintain user sessions.</li>
              <li>Remember user preferences.</li>
              <li>Improve website functionality.</li>
              <li>Understand general website usage.</li>
              <li>Identify and resolve technical issues.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Users may manage certain cookie preferences through their browser settings. However, disabling cookies may
              affect the availability or functionality of certain features.
            </p>
          </section>

          <section id="section-7">
            <h2 className="text-xl font-bold text-[#171717]">7. Your Privacy Choices and Rights</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Depending on the available features and applicable requirements, you may have the ability to:
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Review and update your account information.</li>
              <li>Correct inaccurate personal information.</li>
              <li>Manage certain account preferences.</li>
              <li>Request assistance regarding your account.</li>
              <li>Contact us regarding questions about how your information is handled.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Certain information may need to be retained when necessary for order records, security, legal requirements,
              or other legitimate operational purposes.
            </p>
          </section>

          <section id="section-8">
            <h2 className="text-xl font-bold text-[#171717]">8. Account Information and Security</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers are responsible for maintaining the security of their account credentials.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">You should not:</p>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Share your password with others.</li>
              <li>Allow unauthorized individuals to access your account.</li>
              <li>Attempt to access another customer&apos;s account.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              If you believe that your account has been accessed without authorization, you should contact Pastry Project
              as soon as possible.
            </p>
          </section>

          <section id="section-9">
            <h2 className="text-xl font-bold text-[#171717]">9. Loyalty Points and Privacy</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Information related to your participation in the Loyalty Rewards Program may be connected to your customer
              account.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">This information may include:</p>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Points earned from completed orders.</li>
              <li>Points redeemed.</li>
              <li>Available rewards.</li>
              <li>Redemption history.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              This information is used to manage and operate the loyalty program and provide customers with accurate
              reward information.
            </p>
          </section>

          <section id="section-10">
            <h2 className="text-xl font-bold text-[#171717]">10. Customized Orders and Uploaded Content</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers may provide customization details or upload reference images when requesting customized cakes or
              other products.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Any information or images provided may be used for the purpose of reviewing, preparing, and completing the
              requested customized order.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers should avoid submitting unnecessary personal or sensitive information within reference images or
              customization requests.
            </p>
          </section>

          <section id="section-11">
            <h2 className="text-xl font-bold text-[#171717]">11. Children&apos;s Privacy</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project is not intended to knowingly collect personal information from children without appropriate
              authorization.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              If we become aware that personal information has been provided in a manner that requires additional
              protection under applicable requirements, appropriate steps may be taken to review and manage the
              information.
            </p>
          </section>

          <section id="section-12">
            <h2 className="text-xl font-bold text-[#171717]">12. Third-Party Services</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project may use third-party services or integrations to support certain platform functions.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">These services may include:</p>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-8 text-gray-700">
              <li>Payment services.</li>
              <li>Delivery services.</li>
              <li>Email or notification services.</li>
              <li>Other service integrations.</li>
            </ul>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Third-party services may have their own privacy policies and practices. Pastry Project encourages users
              to review the applicable policies when using third-party services.
            </p>
          </section>

          <section id="section-13">
            <h2 className="text-xl font-bold text-[#171717]">13. Compliance with the Data Privacy Act of 2012</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Pastry Project is committed to handling personal information responsibly and in accordance with
              applicable data privacy requirements, including the <span className="font-semibold">Data Privacy Act of
              2012 (Republic Act No. 10173)</span> of the Philippines.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              We collect and process personal information only when reasonably necessary to provide and improve our
              services. This may include information used for account registration, order processing, delivery
              coordination, customer communication, customized orders, loyalty rewards, payment-related transactions,
              and other features available through the Pastry Project platform.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Personal information will be handled using reasonable security measures designed to protect it against
              unauthorized access, disclosure, alteration, loss, misuse, or destruction.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Customers may contact Pastry Project regarding questions or concerns about the collection, use, storage,
              or protection of their personal information.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Where applicable, customers may request assistance regarding their personal information, including
              requests to review or update inaccurate information, subject to applicable requirements and legitimate
              operational or legal purposes.
            </p>
          </section>

          <section id="section-14">
            <h2 className="text-xl font-bold text-[#171717]">14. Changes to This Privacy Policy</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              We may update this Privacy Policy from time to time to reflect changes in our services, website features,
              information practices, or other operational requirements.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              When changes are made, the updated Privacy Policy may include a revised <span className="font-semibold">Last
              Updated</span> date.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              We encourage customers to review this Privacy Policy periodically to remain informed about how
              information is handled.
            </p>
            <p className="mt-3 text-base leading-8 text-gray-700">
              Continued use of Pastry Project after changes have been posted may indicate acknowledgment of the updated
              Privacy Policy.
            </p>
          </section>

          <section id="section-15">
            <h2 className="text-xl font-bold text-[#171717]">15. Contact Us</h2>
            <p className="mt-3 text-base leading-8 text-gray-700">
              If you have questions, concerns, or requests regarding this Privacy Policy or the handling of your
              personal information, you may contact <span className="font-semibold text-[#171717]">Pastry Project</span>
              through the contact information or customer support features available on the website.
            </p>
          </section>
        </div>          </div>
        </div>      </div>
    </div>
  );
}
