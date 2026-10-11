import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, LaptopMinimal } from "lucide-react";
import { ROOT_BASE } from "../../services/config";

const LOGO_URL = process.env.NODE_ENV === "production"
  ? `${ROOT_BASE}/uploads/logo.png`
  : "/assets/logo.png";
const ADMIN_MIN_WIDTH = 768;
const PHONE_QUERY = `(max-width: ${ADMIN_MIN_WIDTH - 1}px)`;

function isPhoneViewport() {
  return typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches;
}

export default function AdminDeviceGuard({ children }) {
  const [isPhone, setIsPhone] = useState(isPhoneViewport);

  useEffect(() => {
    const mediaQuery = window.matchMedia(PHONE_QUERY);
    const updateViewport = (event) => setIsPhone(event.matches);
    mediaQuery.addEventListener("change", updateViewport);

    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  if (!isPhone) return children;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fffaf0] px-4 py-8 text-[#4a2b1d] sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-28 h-64 w-96 -rotate-[30deg] rounded-[45%] bg-[#fff1c9]" />
        <div className="absolute -bottom-32 -right-20 h-72 w-80 rotate-[-25deg] rounded-[45%] bg-[#fff1c9]" />
        <Heart className="absolute right-[10%] top-[9%] h-7 w-7 rotate-12 text-[#d8ad4b]" fill="currentColor" />
        <Heart className="absolute bottom-[12%] left-[8%] h-6 w-6 -rotate-12 text-[#d8ad4b]" fill="currentColor" />
        <svg className="absolute right-0 top-0 h-40 w-48 text-[#d8ad4b]" viewBox="0 0 192 160" fill="none">
          <path d="M190 12C145 4 142 57 106 58C74 59 73 35 58 42C40 51 63 76 82 64C105 49 82 116 0 104" stroke="currentColor" strokeWidth="2" />
        </svg>
        <div className="absolute -bottom-3 -right-5 text-[88px] opacity-80" aria-hidden="true">🧁</div>
      </div>

      <section className="relative z-10 w-full max-w-[620px] rounded-[30px] border border-white/80 bg-white/75 px-6 py-9 text-center shadow-[0_20px_70px_rgba(112,78,30,0.09)] backdrop-blur-sm sm:px-12 sm:py-12">
        <div className="flex flex-col items-center">
          <img src={LOGO_URL} alt="Pastry Project logo" className="h-14 w-14 object-contain" />
          <div className="mt-2 flex items-center gap-1 font-serif text-[34px] font-bold leading-none sm:text-[42px]">
            <span>Pastry</span>
            <span className="text-[#dfb34a]">Project</span>
          </div>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.32em] text-[#755e4d]">Bakeshop &amp; Daily</p>
          <span className="mt-7 h-1.5 w-16 rounded-full bg-[#dfb34a]" />
        </div>

        <div className="mx-auto mt-10 flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#fff5d9] text-[#d6a83f] ring-1 ring-[#f5e6bc]">
          <LaptopMinimal className="h-12 w-12" strokeWidth={1.6} />
        </div>

        <h1 className="mt-8 font-serif text-[30px] font-bold leading-[1.12] text-[#4a2b1d] sm:text-[38px]">
          Best Viewed on a<br />Larger Screen
        </h1>
        <p className="mx-auto mt-5 max-w-[440px] text-justify [text-align-last:center] text-[15px] leading-7 text-[#70594a] sm:text-base sm:leading-8">
          The Pastry Project Admin Portal is designed for tablets, laptops, and desktop computers.
          For the best experience, please open this page on a larger device.
        </p>

        <div className="mx-auto mt-8 border-t border-[#f0dfb6] pt-6">
          <Heart className="mx-auto h-4 w-4 text-[#d8ad4b]" fill="currentColor" />
          <p className="mx-auto mt-3 max-w-[380px] text-sm leading-6 text-[#70594a]">
            For customers, visit the{" "}
            <Link to="/customer" className="font-semibold text-[#9a6e20] underline decoration-[#dfb34a] underline-offset-4">
              Pastry Project customer website
            </Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
