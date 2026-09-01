import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Cake, Gift, MapPinned, Sparkles, Truck, Star } from 'lucide-react';

const offerings = [
  {
    icon: Cake,
    title: 'Delicious Products',
    description: 'Browse a selection of cakes, pastries, desserts, and baked treats available through our platform.',
  },
  {
    icon: Sparkles,
    title: 'Customized Orders',
    description: 'Request personalized cakes and pastries based on your preferred design, flavor, size, message, and more.',
  },
  {
    icon: Truck,
    title: 'Delivery & Pickup',
    description: 'Choose delivery or pickup with a convenient, flexible ordering experience designed around your schedule.',
  },
  {
    icon: Gift,
    title: 'Loyalty Rewards',
    description: 'Earn points from eligible completed orders and redeem them through our rewards program.',
  },
];

export default function AboutUsPage() {
  return (
    <div className="min-h-screen bg-white text-[#171717]">
      <section className="relative overflow-hidden bg-white">
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-14">
          <div className="flex flex-col justify-center">
            <div className="mb-4 flex items-center gap-3">
              <img src="/assets/logo-transparent.png" alt="Pastry Project logo" className="h-12 w-12 rounded-none bg-transparent object-contain" />
              <p className="text-2xl font-black tracking-tight text-[#171717]">Pastry Project</p>
            </div>

            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#b18a23]">About Pastry Project</p>
            <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] text-[#171717] sm:text-5xl lg:text-6xl">
              Making Sweet Moments Special
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-gray-700">
              At <span className="font-semibold text-[#171717]">Pastry Project</span>, we believe every sweet moment deserves something special.
              We create delicious pastries, cakes, and baked treats that bring people together and make every occasion more memorable.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/customer/menu"
                className="inline-flex items-center gap-2 rounded-full bg-[#171717] px-6 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#b18a23]"
              >
                Explore Menu <ArrowRight size={16} />
              </Link>
              <Link
                to="/customer/customized-cakes"
                className="inline-flex items-center gap-2 rounded-full border border-[#d9c07a] bg-[#fffaf0] px-6 py-3 text-sm font-black uppercase tracking-[0.18em] text-[#171717] transition hover:bg-[#fff4d6]"
              >
                Customize Orders
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Star size={16} className="text-[#b18a23]" /> Freshly prepared treats
              </div>
              <div className="flex items-center gap-2">
                <MapPinned size={16} className="text-[#b18a23]" /> Easy ordering & delivery
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-10 top-8 h-28 w-28 rounded-full bg-gray-100 blur-3xl" />
            <div className="absolute -right-6 bottom-8 h-32 w-32 rounded-full bg-gray-100 blur-3xl" />
            <div className="relative overflow-hidden rounded-[32px] border border-gray-200 bg-white p-3 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
              <div
                className="h-[520px] rounded-[26px] bg-cover bg-center"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1000&q=80')",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-10">
        <section className="p-8 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-[#b18a23]">Our Story</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-[#171717] sm:text-4xl">Built for convenient, joyful ordering</h2>
          <p className="mt-5 max-w-4xl text-lg leading-8 text-gray-700">
            Pastry Project was created with the goal of making ordering pastries and cakes easier, more convenient,
            and more enjoyable. We understand that customers have different preferences and occasions to celebrate.
            Whether you are looking for a simple treat, a cake for a birthday, or a customized design for a special event,
            Pastry Project provides a convenient platform where customers can explore available products and place orders
            based on their preferences.
          </p>
          <p className="mt-4 max-w-4xl text-lg leading-8 text-gray-700">
            Through our platform, customers can browse products, place orders, customize selected cakes and pastries,
            choose between delivery and pickup, and manage their orders in one place.
          </p>
        </section>

        <section className="mt-16">
          <div className="mb-8 text-center">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#b18a23]">What We Offer</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-[#171717] sm:text-4xl">Everything you need for sweet moments</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {offerings.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-[28px] border border-[#d4af37] bg-[#fffaf0] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f2d77c] text-[#b18a23]">
                  <Icon size={24} />
                </div>
                <h3 className="mt-5 text-xl font-black text-[#171717]">{title}</h3>
                <p className="mt-3 text-base leading-7 text-gray-700">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-8 lg:grid-cols-2">
          <div className="p-8">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#b18a23]">Our Mission</p>
            <h3 className="mt-4 text-3xl font-black tracking-tight text-[#171717]">To make ordering pastries and cakes simple and joyful</h3>
            <p className="mt-5 text-lg leading-8 text-gray-700">
              Our mission is to provide customers with a convenient and enjoyable way to discover, customize, and order pastries and cakes.
              We aim to combine the experience of traditional baking with the convenience of an online ordering platform, making it easier
              for customers to enjoy their favorite treats and celebrate special moments.
            </p>
          </div>

          <div className="p-8">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#b18a23]">Our Vision</p>
            <h3 className="mt-4 text-3xl font-black tracking-tight text-[#171717]">A reliable bakery platform customers can trust</h3>
            <p className="mt-5 text-lg leading-8 text-gray-700">
              Our vision is to become a reliable and customer-friendly online platform for ordering pastries, cakes, and customized baked products.
              We strive to continuously improve the customer experience by providing convenient ordering features, reliable services, and a platform that makes every celebration and sweet moment easier to enjoy.
            </p>
          </div>
        </section>

        <section className="mt-16 p-8 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-[#b18a23]">Why Choose Us?</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-[#171717] sm:text-4xl">We focus on a simple, customer-friendly experience</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[
              'Browse available products easily.',
              'Customize selected cakes and pastries.',
              'Place orders online.',
              'Choose delivery or pickup.',
              'Track and manage order information.',
              'Earn and redeem loyalty rewards.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl bg-[#fffaf0] p-4 text-base text-gray-700">
                <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#d4af37] text-[10px] font-black text-[#171717]">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-[32px] bg-[#171717] px-6 py-12 text-center text-white sm:px-8 lg:px-12">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-[#f2d77c]">Made for Every Sweet Moment</p>
          <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">Browse. Customize. Order. Enjoy.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-300">
            Whether it is a birthday, anniversary, celebration, gift, or simply a craving for something sweet,
            <span className="font-semibold text-[#f2d77c]"> Pastry Project</span> is here to help make every moment more memorable.
          </p>
        </section>
      </main>
    </div>
  );
}
