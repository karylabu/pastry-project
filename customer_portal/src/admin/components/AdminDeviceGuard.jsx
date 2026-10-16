import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Monitor } from "lucide-react";
import { ROOT_BASE } from "../../services/config";

const LOGO_URL = process.env.NODE_ENV === "production"
  ? `${ROOT_BASE}/uploads/logo.png`
  : "/assets/logo.png";
const ADMIN_MIN_WIDTH = 600;
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#fffdf7] via-[#fffaf0] to-[#fff4dc] px-4 py-7 text-[#4a2b1d] sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[#f8e8b5]/50 blur-3xl" />
        <div className="absolute -bottom-28 -right-24 h-72 w-72 rounded-full bg-[#f4dfaa]/45 blur-3xl" />
      </div>

      <section className="relative z-10 w-full max-w-[440px] rounded-[30px] border border-[#f1e6ce] bg-white/90 px-5 py-8 text-center shadow-[0_24px_80px_rgba(92,61,25,0.12)] backdrop-blur-sm sm:px-10 sm:py-10">
        <div className="flex flex-col items-center">
          <img src={LOGO_URL} alt="Pastry Project logo" className="h-12 w-12 object-contain" />
          <div className="mt-2 flex items-center gap-1 font-serif text-[30px] font-bold leading-none sm:text-[36px]">
            <span>Pastry</span>
            <span className="text-[#dfb34a]">Project</span>
          </div>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#806b58]">Bakeshop &amp; Daily</p>
          <span className="mt-5 h-1 w-12 rounded-full bg-[#dfb34a]" />
        </div>

        <div role="img" aria-label="Desktop monitor icon" className="mx-auto mt-8 flex h-[76px] w-[76px] items-center justify-center rounded-[24px] bg-gradient-to-br from-[#fff8e5] to-[#fff0c7] text-[#bd9130] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-[#f0dfb0]">
          <Monitor aria-hidden="true" className="h-10 w-10" strokeWidth={1.7} />
        </div>

        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a47b27]">
          Admin portal
        </p>
        <h1 className="mx-auto mt-2 max-w-[340px] font-serif text-[29px] font-bold leading-[1.12] text-[#4a2b1d] sm:text-[34px]">
          Best Viewed on a Larger Screen
        </h1>
        <p className="mx-auto mt-4 max-w-[350px] text-[15px] leading-7 text-[#70594a] sm:text-base sm:leading-7">
          The Pastry Project Admin Portal is designed for tablets, laptops, and desktop computers.
          {" "}For the best experience, please open this page on a larger device.
        </p>

        <div className="mx-auto mt-7 border-t border-[#f0dfb6] pt-5">
          <Heart className="mx-auto h-4 w-4 text-[#d8ad4b]" fill="currentColor" />
          <p className="mx-auto mt-3 max-w-[340px] text-sm leading-6 text-[#70594a]">
            For customers, visit our
          </p>
          <Link to="/customer" className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full border border-[#e9d49b] bg-[#fffaf0] px-5 text-sm font-semibold text-[#8d671d] shadow-sm transition hover:bg-[#fff4d6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9130]">
            Pastry Project customer website
          </Link>
        </div>
      </section>
    </main>
  );
}
