import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Headphones,
  Paperclip,
  ArrowLeft,
  Phone,
  Plus,
  History,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Gift,
  Star,
  Tag,
  Heart,
  ClipboardList,
  CakeSlice,
  Baby,
  Flower2,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import ProductModal from "../components/ProductModal";
import CustomCakeModal from "../components/CustomCakeModal";
import { CUSTOMER_BASE, LARAVEL_BASE, ROOT_BASE } from "../../services/config";
import { getAuthHeaders, safeParseJson } from "../../services/api";
import { subscribeRealtime } from "../../services/realtime";

/* =========================
   HERO BANNER SLIDES
  First slide uses the uploaded banner image, followed by pastry photos.
   Swap the src values below for your own assets.
========================= */
const HERO_SLIDES = [
  {
    type: "image",
    src: `${ROOT_BASE}/uploads/banner(1).png`,
  },
  {
    type: "video",
    src: `${ROOT_BASE}/uploads/banner(2).mp4`,
  },
];

function Banner({ onShopNow, onCustomizeNow }) {
  const [slide, setSlide] = useState(0);
  const total = HERO_SLIDES.length;
  const currentSlide = HERO_SLIDES[slide] || HERO_SLIDES[0];

  const goTo = (i) => setSlide(((i % total) + total) % total);
  const next = () => goTo(slide + 1);
  const prev = () => goTo(slide - 1);

  // auto-advance every 6s, paused while the video slide is showing
  useEffect(() => {
    if (!currentSlide || currentSlide.type === "video") return;
    const t = setTimeout(next, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, currentSlide]);

  return (
    <div className="relative mx-auto aspect-video w-full max-w-[1380px] bg-white flex items-center justify-center overflow-hidden font-['DM_Sans']">

      {/* SLIDES */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slide}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0"
        >
          {currentSlide?.type === "video" ? (
            <video
              className="absolute inset-0 w-full h-full object-cover"
              src={currentSlide.src}
              poster={currentSlide.poster}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img
              src={currentSlide?.src}
              alt="Pastry Project banner"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {slide === 1 && (
        <button
          type="button"
          aria-label="Customize Now"
          onClick={onCustomizeNow}
          className="absolute bottom-[10%] left-[2.5%] z-20 flex h-[8.5%] w-[13.2%] min-h-8 items-center justify-center rounded-full border-2 border-[#3b2318] bg-[#fffaf0] font-serif text-[clamp(10px,1.3vw,22px)] font-semibold text-[#3b2318] shadow-sm transition hover:bg-[#d4af37]"
        >
          Customize Now
        </button>
      )}

      {total > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous slide"
            className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/30 text-white flex items-center justify-center backdrop-blur-sm transition"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={next}
            aria-label="Next slide"
            className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/30 text-white flex items-center justify-center backdrop-blur-sm transition"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {total > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === slide ? "w-8 bg-[#d4af37]" : "w-3 bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SecondaryBanner({ onOrderNow }) {
  const secondaryBanner = {
    type: "image",
    src: `${ROOT_BASE}/uploads/banner(2).png`,
  };

  return (
    <section className="mb-4 mt-2 overflow-hidden rounded-xl border border-[#eadfd8] bg-white shadow-[0_5px_18px_rgba(91,64,39,0.05)]">
      <div className="relative h-[200px] w-full overflow-hidden sm:h-[240px] md:h-[290px] lg:h-[340px]">
        {secondaryBanner.type === "video" ? (
          <video
            className="h-full w-full object-cover scale-[1.08]"
            src={secondaryBanner.src}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <img
            src={secondaryBanner.src}
            alt="Pastry Project banner"
            className="h-full w-full object-cover scale-[1.08]"
          />
        )}
        <button
          type="button"
          onClick={onOrderNow}
          className="absolute left-[50%] top-[70%] z-10 inline-flex -translate-y-1/2 items-center gap-3 rounded-full bg-[#73785c] px-5 py-2.5 font-serif text-sm font-medium text-white shadow-sm transition hover:bg-[#5f654a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
        >
          Order Now <ArrowRight size={15} strokeWidth={1.8} />
        </button>
      </div>
    </section>
  );
}

const PIZZA_IMAGE_FALLBACKS = {
  'spinach pizza': 'Spinach.png',
  'four-cheese pizza': 'four_cheese.png',
  'breakfast pizza': 'Breakfast.png',
  'hawaiian pizza': 'Hawaiian.png',
  'veggie pizza': 'Veggie.png',
  'pepperoni pizza': 'Pepperoni.png',
  'ham and cheese pizza': 'meal7.png',
  'ham & cheese pizza': 'meal7.png',
};

const COFFEE_IMAGE_FALLBACKS = {
  'americano': 'americano.png',
  'cappuccino': 'Capuccino.png',
  'capuccino': 'Capuccino.png',
  'pastry project latte': 'Pastryprojlatte.png',
  'matcha cream latte': 'matcha.png',
  'matcha latte': 'Matchalatte.png',
  'latte': 'Pastryprojlatte.png',
  'white chocolate': 'Whitechocolate(1).png',
  'caramel': 'Caramel2.png',
  'salted caramel': 'Saltedcaramel.png',
  'mocha': 'Mocha.png',
  'hazelnut': 'Hazelnut.png',
  'vanilla': 'Vanilla (1).png',
  'dirty matcha': 'Dirtymatcha.png',
};

const DRINK_IMAGE_FALLBACKS = {
  'caramel': 'Caramel.png',
  'salted caramel': 'Saltedcaramel (1).png',
  'white chocolate': 'Whitechocolate(1).png',
  'oreo': 'Oreo.png',
  'matcha': 'Matcha.png',
  'vanilla': 'Vanilla.png',
  'chocolate chip cream': 'Chocolate.png',
  'strawberry yogurt smoothie': 'Strawberryyogurtsmoothie.png',
  'mango yogurt smoothie': 'Mangoyogurtsmoothie.png',
  'blueberry yogurt smoothie': 'Blueberryyogurtsmoothie.png',
  'raspberry yogurt smoothie': 'Rasberryyogurtsmoothie.png',
  'plain yogurt smoothie': 'Plainyogurtsmoothie.png',
  'chocolate': 'Chocolate.png',
  'blueberry ade': 'Blueberryade.png',
  'strawberry ade': 'Strawberryade.png',
  'mango ade': 'Mangoade.png',
  'passion fruit fizz': 'Passionfruitfizz.png',
  'blueberry fizz': 'Blueberryfizz.png',
  'mango fizz': 'Mangofizz.png',
  'strawberry fizz': 'Strawberryfizz.png',
  'kiwi fizz': 'Kiwifizz.png',
  'passion fruit tea': 'Passionfruittea.png',
  'blueberry fruit tea': 'Blueberryfruittea.png',
  'mango fruit tea': 'Mangofruittea.png',
  'strawberry fruit tea': 'Strawberryfruittea.png',
  'kiwi fruit tea': 'Kiwifruittea.png',
};

const STARTER_IMAGE_FALLBACKS = {
  'cheesy bacon fries': 'cheesy.png',
  'chicken nuggets': 'chicken.png',
  'french fries': 'french.png',
  'mojos hot': 'mojos_hot.png',
  'mojos': 'mojos.png',
  'mozzarella sticks': 'mozarella.png',
  'potato wedges': 'potato.png',
};

const productImageUrl = (filename) => `${CUSTOMER_BASE}/uploads/${filename}?v=transparent-v26`;

const getCategoryFallbackImage = (category = '') => {
  const normalizedCategory = String(category || '').trim().toLowerCase();

  if (normalizedCategory.includes('coffee')) return `${ROOT_BASE}/uploads/americano.png`;
  if (normalizedCategory.includes('coffee')) return productImageUrl('americano.png');
  if (normalizedCategory.includes('drink')) return productImageUrl('caramel.png');
  if (normalizedCategory.includes('pizza')) return productImageUrl('pepperoni.png');
  if (normalizedCategory.includes('starter')) return productImageUrl('chicken.png');

  return `${ROOT_BASE}/uploads/americano.png`;
  return productImageUrl('americano.png');
};

const resolveProductImage = (product) => {
  const productName = String(product?.name || '').trim().toLowerCase();
  const category = String(product?.category || '').trim().toLowerCase();

  let fallbackMap = null;
  if (category.includes('pizza')) fallbackMap = PIZZA_IMAGE_FALLBACKS;
  else if (category.includes('coffee')) fallbackMap = COFFEE_IMAGE_FALLBACKS;
  else if (category.includes('drink')) fallbackMap = DRINK_IMAGE_FALLBACKS;
  else if (category.includes('starter')) fallbackMap = STARTER_IMAGE_FALLBACKS;

  const fallbackFile = fallbackMap
    ? Object.entries(fallbackMap).find(([key]) => productName.includes(key))?.[1]
    : null;

  if (fallbackFile) {
    return productImageUrl(fallbackFile);
  }

  if (product?.image) {
    return productImageUrl(product.image);
  }

  return getCategoryFallbackImage(category);
};

const resolveCustomReferenceImage = (order) => {
  let details = order?.custom_details;
  if (typeof details === 'string') {
    try { details = JSON.parse(details); } catch { details = null; }
  }

  let images = details?.inspo_images;
  if (typeof images === 'string') {
    try { images = JSON.parse(images); } catch { images = [images]; }
  }
  const image = Array.isArray(images) ? images[0] : '';
  if (!image) return '';
  if (/^(https?:|data:|blob:)/i.test(image)) return image;
  return `${ROOT_BASE}/${String(image).replace(/^\/+/, '')}`;
};

function RecommendationCard({ product, onSelect }) {
  const fallbackImage = getCategoryFallbackImage(product?.category);
  const normalizedProductName = String(product?.name || '').trim().toLowerCase();
  const isStarterProduct = /\b(starter|starters)\b/i.test(String(product?.category || ''));
  const shouldEnlargeCakeImage = /\b(caramel|sans rival|sansrival)\b/i.test(normalizedProductName);
  const shouldEnlargeDrinkSize = /\b(strawberry fruit tea|matcha|vanilla|mango ade|blueberry ade|blueberry fizz|strawberry fizz|passion fruit tea|kiwi fruit tea)\b/i.test(normalizedProductName);
  const isSmallCoffeeProduct = /\b(matcha latte|vanilla|white chocolate)\b/i.test(normalizedProductName) && /\bcoffee\b/i.test(String(product?.category || ''));

  const cakeSizeOptions = Array.isArray(product?.sizes)
    ? product.sizes.filter((option) => String(option.size || '').trim().toLowerCase() !== 'slice')
    : [];
  const sizeOptions = Array.isArray(product?.sizes) && product.sizes.length > 0
    ? cakeSizeOptions.length > 0 ? cakeSizeOptions : [{ size: 'Small', price: Number(product?.small_price || 0) }, { size: 'Big', price: Number(product?.big_price || 0) }]
    : [{ size: 'Regular', price: Number(product?.price || 0) }];

  const [selectedSize, setSelectedSize] = useState(sizeOptions[0]?.size || 'Regular');

  useEffect(() => {
    if (sizeOptions.length > 0 && !sizeOptions.some((option) => String(option.size || 'Regular') === selectedSize)) {
      setSelectedSize(sizeOptions[0].size || 'Regular');
    }
  }, [selectedSize, sizeOptions]);

  const selectedPrice = sizeOptions.find((option) => String(option.size || 'Regular') === selectedSize)?.price
    ?? Number(product?.price || 0);

  return (
    <div className="flex h-full min-h-[226px] min-w-0 flex-col rounded-xl border border-[#eadfd8] bg-[#fffaf7] p-2 shadow-[0_5px_14px_rgba(91,64,39,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#e7c875] hover:shadow-[0_10px_20px_rgba(91,64,39,0.1)]">
      <div className="mb-2 flex h-[105px] w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#f1e6df] bg-[#f8eee8] p-1">
        <img
          src={resolveProductImage(product)}
          alt={product.name}
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = fallbackImage;
          }}
          className={
            shouldEnlargeDrinkSize || isSmallCoffeeProduct
              ? `h-[92px] w-auto max-w-[82%] max-h-[92px] object-contain object-center transition-transform duration-500 ${isSmallCoffeeProduct ? 'scale-110' : 'scale-105'}`
              : product?.category && /\b(cake|cakes|meal|meals|pasta|starter|starters)\b/i.test(String(product.category))
                ? `${shouldEnlargeCakeImage ? 'h-[104px] max-h-[104px] max-w-[90%]' : 'h-[94px] max-h-[94px] max-w-[84%]'} w-auto object-contain object-center transition-transform duration-500 scale-100`
                : 'h-[92px] w-auto max-w-[82%] max-h-[92px] object-contain object-center transition-transform duration-500 scale-100'
          }
                  style={isStarterProduct ? { mixBlendMode: 'multiply' } : undefined}
        />
      </div>

      <h3 className="min-h-[1.35rem] line-clamp-2 text-[11px] font-bold leading-tight text-[#33251e]">{product.name}</h3>
      <p className="mt-0.5 text-[11px] font-semibold text-[#33251e]">₱{Number(selectedPrice || 0).toLocaleString()}</p>

      <div className="mt-1 flex min-h-[16px] flex-wrap justify-center gap-1">
        {sizeOptions.map((option) => {
          const label = String(option.size || 'Regular');
          const isSelected = selectedSize === label;
          return (
            <button
              key={`${product.id}-${label}`}
              type="button"
              onClick={() => setSelectedSize(label)}
              className={`rounded-full border px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[0.08em] ${
                isSelected
                  ? 'border-[#d4af37] bg-[#f7e8b0] text-black'
                  : 'border-stone-200 bg-stone-50 text-stone-600'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSelect?.(product, selectedSize, Number(selectedPrice || product.price || 0))}
        className="mt-2 h-7 w-full rounded-lg border border-[#eadfca] bg-[#fff8e9] py-1.5 text-[8px] font-semibold text-[#33251e] transition-colors hover:border-[#e7c875] hover:bg-[#fff8df] hover:text-[#8d6a2e]"
      >
        Add to Cart
      </button>
    </div>
  );
}

const CUSTOMER_TESTIMONIALS = [
  { name: 'Alyssa D.', initials: 'AD', quote: 'The cake was so good! Fresh, beautiful, and exactly what I ordered. Will definitely order again!' },
  { name: 'Mark T.', initials: 'MT', quote: 'Super easy to customize and the design was perfect for my daughter\'s birthday!' },
  { name: 'Camille S.', initials: 'CS', quote: 'Their cakes are always fresh and delicious! Highly recommended!' },
  { name: 'Jamie R.', initials: 'JR', quote: 'The details were lovely and the whole ordering experience was smooth.' },
  { name: 'Nica P.', initials: 'NP', quote: 'Beautiful cake, generous portions, and it arrived right on time.' },
  { name: 'Daniel C.', initials: 'DC', quote: 'The flavor was amazing. Pastry Project is now our family favorite.' },
];

function TestimonialsSection() {
  const [slide, setSlide] = useState(0);
  const visibleTestimonials = CUSTOMER_TESTIMONIALS.slice(slide, slide + 3);
  const maxSlide = CUSTOMER_TESTIMONIALS.length - 3;

  return (
    <section className="relative overflow-hidden bg-[#fffaf0] px-4 py-10 sm:px-8 md:px-12">
      <div className="mx-auto max-w-[1100px]">
        <div className="text-center"><p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#9b7b3d]">Customer love</p><h2 className="mt-1 font-serif text-2xl text-[#3c2925] md:text-3xl">Real People, Real Sweet Moments</h2><p className="mt-1 text-xs text-[#765f5d]">See what our customers are saying!</p></div>
        <div className="relative mt-7 grid gap-4 md:grid-cols-3">
          {visibleTestimonials.map((testimonial) => (
            <article key={testimonial.name} className="rounded-xl border border-[#eadfd8] bg-white px-5 py-5 text-center shadow-[0_6px_16px_rgba(91,64,39,0.08)]">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#f5eee5] text-xs font-black text-[#7c654f]">{testimonial.initials}</div>
              <p className="mt-4 min-h-[72px] text-[11px] leading-5 text-[#413734]">“{testimonial.quote}”</p>
              <p className="mt-3 text-[11px] font-bold text-[#765d50]">- {testimonial.name}</p>
              <div className="mt-2 flex justify-center gap-0.5 text-[#e8b52e]" aria-label="5 out of 5 stars">{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={14} fill="currentColor" strokeWidth={1.4} />)}</div>
            </article>
          ))}
          <button type="button" aria-label="Previous testimonials" disabled={slide === 0} onClick={() => setSlide((current) => Math.max(0, current - 1))} className="absolute -left-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#eadfd8] bg-white text-[#765d50] shadow-sm disabled:opacity-40 md:-left-10"><ChevronLeft size={17} /></button>
          <button type="button" aria-label="Next testimonials" disabled={slide === maxSlide} onClick={() => setSlide((current) => Math.min(maxSlide, current + 1))} className="absolute -right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#eadfd8] bg-white text-[#765d50] shadow-sm disabled:opacity-40 md:-right-10"><ChevronRight size={17} /></button>
        </div>
        <div className="mt-5 flex justify-center gap-1.5" aria-label="Testimonial pages">{Array.from({ length: maxSlide + 1 }, (_, index) => <button key={index} type="button" aria-label={`Show testimonial page ${index + 1}`} onClick={() => setSlide(index)} className={`h-1.5 rounded-full transition-all ${slide === index ? 'w-5 bg-[#8d6a2e]' : 'w-1.5 bg-[#eadfca]'}`} />)}</div>
      </div>
    </section>
  );
}

/* =========================
   CHAT BUBBLE COMPONENT
========================= */
export function ChatBubble({ aiMode = false, fullPage = false }) {
  const hasCustomerAccount = typeof window !== 'undefined'
    ? (() => {
        try {
          return Boolean(JSON.parse(localStorage.getItem('user') || 'null')?.id);
        } catch {
          return false;
        }
      })()
    : false;
  const navigate = useNavigate();
  const [open, setOpen]           = useState(fullPage && hasCustomerAccount);
  const [step, setStep]           = useState("chatting");
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [sending, setSending]     = useState(false);
  const [chatError, setChatError] = useState("");
  const [staffMode, setStaffMode] = useState(false);
  const [unread, setUnread]       = useState(0);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showStoreNumber, setShowStoreNumber] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const [conversationId, setConversationId] = useState(() => localStorage.getItem("active_customer_service_chat") || "legacy");
  const [historyIds, setHistoryIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("customer_service_chat_history") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("active_customer_service_chat", conversationId);
  }, [conversationId]);
  const bottomRef                 = useRef(null);
  const messagesContainerRef      = useRef(null);
  const shouldStickToBottomRef    = useRef(true);
  const pollRef                   = useRef(null);
  const imageInputRef             = useRef(null);

  const savedUser = typeof window !== 'undefined'
    ? (() => {
        try {
          return JSON.parse(localStorage.getItem('user') || '{}');
        } catch {
          return {};
        }
      })()
    : {};

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (shouldStickToBottomRef.current) {
      scrollToBottom();
    }
  }, [messages, sending, step, open]);

  useEffect(() => {
    if (step === "chatting") {
      fetchMessages();
      return subscribeRealtime((event) => {
        if (event.type === "chat.updated" && (!event.conversation_id || event.conversation_id === conversationId)) {
          fetchMessages(true);
        }
      });
    }
    return undefined;
  }, [step, conversationId, showHistory, open]);

  const fetchMessages = async (mergeWithCurrent = false) => {
    try {
      const params = new URLSearchParams({
        order_id: "0",
        conversation_id: conversationId,
        mark_read: open ? "1" : "0",
      });
      const res  = await fetch(`${CUSTOMER_BASE}/api/customer/chat/messages?${params.toString()}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const data = await safeParseJson(res);
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Chat history request failed (${res.status})`);
      }
      const fetchedMessages = Array.isArray(data.messages) ? data.messages : [];
      setMessages(previousMessages => {
        if (!mergeWithCurrent) return fetchedMessages;

        const merged = new Map(
          previousMessages
            .filter(message => !String(message.id).startsWith("pending-"))
            .map(message => [String(message.id), message])
        );
        fetchedMessages.forEach(message => merged.set(String(message.id), message));
        return Array.from(merged.values()).sort((left, right) => (
          new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
        ));
      });
      setChatError("");
      if (!open) {
        const newStaff = fetchedMessages.filter(message => (
          ["admin", "staff"].includes(String(message.sender).toLowerCase()) &&
          Number(message.is_read) === 0
        )).length;
        setUnread(newStaff);
      }
    } catch (e) {
      console.error("Chat fetch error:", e);
      setChatError("Hindi ma-load ang chat history. Pakisubukan ulit.");
    }
  };

  const sendMessage = async (text, silent = false, activeOrderId = 0) => {
    if (!hasCustomerAccount) {
      setShowAccountPrompt(true);
      return;
    }

    const msg = text || input.trim();
    const image = silent ? null : selectedImage;
    if (!msg && !image) return;

    if (!silent) {
      shouldStickToBottomRef.current = true;
      setSending(true);
      setInput("");
      setSelectedImage(null);
      setChatError("");
      // Optimistic UI
      const optimisticId = `pending-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: optimisticId,
        sender: "customer",
        message: msg,
        image_url: image ? URL.createObjectURL(image) : null,
        created_at: new Date().toISOString()
      }]);
    }

    const payloadOrderId = activeOrderId || 0;

    try {
      const formData = new FormData();
      formData.append("order_id", payloadOrderId);
      formData.append("message", msg);
      formData.append("support_mode", "admin");
      formData.append("conversation_id", conversationId);
      if (image) formData.append("image", image);

      const chatApiBase = CUSTOMER_BASE;
      const res  = await fetch(`${chatApiBase}/api/customer/chat/messages`, {
        method: "POST",
        credentials: 'include',
        headers: getAuthHeaders(),
        body: formData
      });
      const data = await safeParseJson(res);

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Message could not be sent");
      }

      setChatError("");
      await fetchMessages(true);
    } catch (e) {
      console.error("Send error:", e);
      if (!silent) {
        setMessages(prev => prev.filter(message => !String(message.id).startsWith("pending-")));
      }
      setChatError("Hindi na-send ang message. Pakisubukan ulit.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatChatDate = (ts) => {
    const date = new Date(ts);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    return isToday
      ? "Today"
      : date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
  };

  const senderLabel = {
    customer: "You",
    staff: "Admin",
    admin: "Admin",
    ai: "Admin"
  };

  const getImageUrl = (message) => message.image_url || (
    message.image_path ? `${CUSTOMER_BASE}/${message.image_path}` : null
  );

  const startFreshChat = () => {
    const nextConversationId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setConversationId(nextConversationId);
    setMessages([]);
    setInput("");
    setSelectedImage(null);
    setStep("chatting");
    setStaffMode(false);
    localStorage.setItem("active_customer_service_chat", nextConversationId);
  };

  return (
    <>
      {/* FLOAT BUTTON */}
      {!fullPage && <div className="fixed bottom-6 right-6 z-[60000] flex items-center gap-3">
        {!open && (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-full bg-white px-4 py-2 shadow-lg border border-gray-200"
          >
            <p className="text-sm font-semibold text-gray-800">Chat with us!</p>
          </motion.div>
        )}
        <div className="relative">
          <button
            onClick={() => {
              if (!hasCustomerAccount) {
                setShowAccountPrompt(true);
                return;
              }
              setOpen(o => !o);
              setUnread(0);
            }}
            className="bg-black text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:bg-gray-800 transition-colors"
          >
            {open ? <X size={20} /> : <MessageCircle size={22} />}
          </button>
          {unread > 0 && !open && (
              <span className="absolute -top-1 -right-1 bg-white text-black border border-black text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {unread}
            </span>
          )}
        </div>
      </div>}

      {/* CHAT PANEL */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={fullPage
              ? "relative w-full min-h-[calc(100vh-180px)] bg-[#f5f5f5] flex flex-col overflow-hidden"
              : "fixed bottom-24 right-6 w-[calc(100vw-2rem)] max-w-[460px] sm:w-[460px] bg-[#f5f5f5] rounded-[20px] shadow-2xl z-[60001] flex flex-col overflow-hidden border border-[#d5d5d5]"}
            style={fullPage ? undefined : { height: aiMode ? "min(620px, calc(100vh - 7rem))" : "min(500px, calc(100vh - 7rem))" }}
          >
            {/* HEADER */}
            <div className={fullPage ? "bg-black px-4 py-4 sm:px-8 sm:py-5 flex items-center gap-3 sm:gap-4 border-b border-black text-white" : "bg-black px-5 py-4 flex items-center gap-3 border-b border-black text-white"}>
              {fullPage && (
                  <button type="button" onClick={() => setShowHistory(value => !value)} title={showHistory ? "Back to chat" : "View chat history"} aria-label={showHistory ? "Back to chat" : "View chat history"} className="w-9 h-9 rounded-full text-gray-500 hover:bg-gray-100 flex items-center justify-center">
                  <ArrowLeft size={20} />
                </button>
              )}
                  <div className={fullPage ? "w-11 h-11 rounded-2xl bg-white flex items-center justify-center flex-shrink-0" : "w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0"}>
                <Headphones size={fullPage ? 20 : 16} className="text-black" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={fullPage ? "text-white font-bold text-lg sm:text-xl" : "text-white font-semibold text-sm"}>{fullPage ? (showHistory ? "Chat History" : "Customer Service") : "Admin Support"}</p>
                  {fullPage && !showHistory && <span className="hidden rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-black sm:inline-flex">Online</span>}
                </div>
                <p className={fullPage ? "text-white/65 text-xs mt-0.5" : "text-white/65 text-xs"}>
                  {fullPage ? "We usually reply instantly" : "Admin usually replies promptly"}
                </p>
              </div>
              {fullPage && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (messages.length > 0) {
                        const nextHistory = [conversationId, ...historyIds.filter(id => id !== conversationId)].slice(0, 20);
                        setHistoryIds(nextHistory);
                        localStorage.setItem("customer_service_chat_history", JSON.stringify(nextHistory));
                      }
                      const nextConversationId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                      setConversationId(nextConversationId);
                      localStorage.setItem("active_customer_service_chat", nextConversationId);
                      setMessages([]); setInput(""); setSelectedImage(null); setShowHistory(false);
                    }}
                    title="New chat"
                    aria-label="New chat"
                    className="w-10 h-10 rounded-full text-gray-500 hover:bg-gray-100 flex items-center justify-center"
                  >
                    <Plus size={21} />
                  </button>
                  <button type="button" onClick={() => setShowHistory(true)} title="Chat history" aria-label="Chat history" className="w-10 h-10 rounded-full text-gray-500 hover:bg-gray-100 flex items-center justify-center">
                    <History size={21} />
                  </button>
                </div>
              )}
              {step === "chatting" && !fullPage && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowStoreNumber(value => !value)}
                    title="Show store number"
                    aria-label="Show store number"
                    className="w-8 h-8 rounded-full text-white/70 hover:bg-white hover:text-black flex items-center justify-center"
                  >
                    <Phone size={16} />
                  </button>
                  {showStoreNumber && (
                    <span className="text-xs text-white whitespace-nowrap">0938-796-2033</span>
                  )}
                </>
              )}
            </div>

            <>
              {showHistory && (
                <div className="flex-1 overflow-y-auto bg-[#f5f5f5] px-5 py-6 sm:px-10">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Previous conversations</p>
                  {historyIds.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-400">No previous chats yet.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {historyIds.map((id, index) => (
                        <button key={id} type="button" onClick={() => { setConversationId(id); setShowHistory(false); }} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 hover:border-[#e45f32] hover:bg-[#fff7f2]">
                          Conversation {historyIds.length - index}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div
                ref={messagesContainerRef}
                onScroll={(event) => {
                  const element = event.currentTarget;
                  shouldStickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
                }}
                className={showHistory ? "hidden" : "flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5 bg-[#f5f5f5]"}
              >
                {messages.length === 0 && (
                  <div className="px-2 pt-5">
                    <p className="text-center text-gray-400 text-xs">No messages yet. Start a conversation.</p>
                    {fullPage && (
                      <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
                        <p className="text-sm font-semibold text-gray-900">How can we help you today?</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          {["Track my order", "Delivery question", "Payment assistance"].map(topic => (
                            <button key={topic} type="button" onClick={() => setInput(topic)} className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-left text-sm text-gray-700 hover:border-[#e45f32] hover:bg-[#fff7f2]">
                              {topic}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {messages.map((msg, i) => {
                  const isCustomer = msg.sender === "customer";
                  const isAi       = msg.sender === "ai";
                  const messageDate = new Date(msg.created_at).toDateString();
                  const previousDate = i > 0 ? new Date(messages[i - 1].created_at).toDateString() : null;
                  const showDateSeparator = i === 0 || messageDate !== previousDate;

                  return (
                    <React.Fragment key={msg.id ?? i}>
                      {showDateSeparator && (
                        <div className="flex items-center gap-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                          <span className="h-px flex-1 bg-gray-200" />
                          <span>{formatChatDate(msg.created_at)}</span>
                          <span className="h-px flex-1 bg-gray-200" />
                        </div>
                      )}
                      <div className={`flex gap-2 ${isCustomer ? "flex-row-reverse" : "flex-row"}`}>
                        <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold
                          ${isCustomer ? "bg-black text-white" : isAi ? "bg-[#e5e5e5] text-black" : "bg-white border border-[#d5d5d5] text-black"}`}>
                          {isCustomer ? <User size={12} /> : isAi ? <Bot size={12} /> : "S"}
                        </div>

                        <div className={`max-w-[78%] ${isCustomer ? "items-end" : "items-start"} flex flex-col gap-1`}>
                          <span className="text-[11px] text-gray-400 px-1 opacity-75">
                            {senderLabel[msg.sender]} · {formatTime(msg.created_at)}
                          </span>
                              <div className={`px-3 py-2 rounded-2xl text-[13px] leading-relaxed
                            ${isCustomer
                              ? "bg-black text-white rounded-tr-sm"
                              : isAi
                              ? "bg-[#e5e5e5] text-black border border-[#d5d5d5] rounded-tl-sm"
                              : "bg-white text-black border border-[#d5d5d5] rounded-tl-sm"
                            }`}>
                            {getImageUrl(msg) && (
                              <img
                                src={getImageUrl(msg)}
                                alt="Chat attachment"
                                className="max-w-full max-h-48 rounded-lg object-contain mb-1"
                              />
                            )}
                            {msg.message && <p>{msg.message}</p>}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}

                {messages.length > 0 && !messages.some(message => (
                  new Date(message.created_at).toDateString() === new Date().toDateString()
                )) && (
                  <div className="flex items-center gap-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                    <span className="h-px flex-1 bg-gray-200" />
                    <span>Today</span>
                    <span className="h-px flex-1 bg-gray-200" />
                  </div>
                )}

                {sending && (
                  <div className="flex gap-2 items-center">
                    <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center">
                      <Bot size={12} className="text-white" />
                    </div>
                    <div className="bg-white border border-[#d5d5d5] px-4 py-2 rounded-2xl rounded-tl-sm">
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-black rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-black rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-black rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    </div>
                  </div>
                )}

                {chatError && (
                  <p className="px-2 text-center text-[11px] text-red-600" role="alert">
                    {chatError}
                  </p>
                )}

                <div ref={bottomRef} />
              </div>

              {!showHistory && (
                <>
                  <div className="border-t border-[#d5d5d5] bg-white px-3 pt-2.5">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Quick chats</p>
                    <div className="flex flex-wrap gap-2">
                      {["Hi, I need help", "Where is my order?", "I want to place an order", "Can I customize a cake?", "How can I pay?"].map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => sendMessage(suggestion)}
                          disabled={sending}
                          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] text-gray-600 transition hover:border-black hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="px-3 py-2.5 bg-white flex gap-2 items-end">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={e => setSelectedImage(e.target.files?.[0] || null)}
                    />
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={sending}
                      title="Attach picture"
                      className="w-9 h-9 rounded-full border border-gray-200 text-gray-600 flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:border-black hover:text-black transition-colors"
                    >
                      <Paperclip size={15} />
                    </button>
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type your message..."
                      rows={1}
                      className="flex-1 resize-none border border-[#d5d5d5] rounded-xl bg-white px-3 py-2 text-sm text-black outline-none focus:border-black max-h-20"
                    />
                    <button
                      onClick={() => sendMessage()}
                      disabled={(!input.trim() && !selectedImage) || sending}
                      className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-gray-800 transition-colors"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </>
              )}
              {!showHistory && selectedImage && (
                <p className="px-3 pb-2 text-[11px] text-gray-500 bg-white truncate">
                  {selectedImage.name}
                </p>
              )}
            </>
          </motion.div>
        )}
      </AnimatePresence>

      {showAccountPrompt && (
        <div className="fixed inset-0 z-[70000] flex items-center justify-center bg-black/40 px-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900">Account required</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">Please log in or create an account before chatting with Admin.</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAccountPrompt(false)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => navigate('/customer/login')}
                className="flex-1 rounded-xl bg-black px-4 py-2.5 text-xs font-semibold text-white hover:bg-gray-800"
              >
                Log in
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const isCakeProduct = (product) => {
  const productName = String(product?.name || '').toLowerCase();
  const nonCakeName = /fries|pizza|pasta|coffee|latte|smoothie|\bade\b|fizz|fruit tea|nuggets|mojos|mozzarella|sandwich/i.test(productName);
  return /\bcakes?\b/i.test(String(product?.category || '')) && !nonCakeName;
};

export function buildMustTryList(products = []) {
  const targets = [
    "ube flan",
    "sans rival",
    "sansrival"
  ];

  const available = (Array.isArray(products) ? products : [])
    .filter((p) => p && p.name)
    .filter(isCakeProduct)
    .map((p) => ({
      ...p,
      lowerName: String(p.name).toLowerCase().trim()
    }))
    .filter((p) => !p.lowerName.includes("customization"));

  const selected = [];

  targets.forEach((target) => {
    const match = available.find((p) => p.lowerName.includes(target));
    if (match && !selected.some((item) => item.id === match.id)) {
      selected.push(match);
    }
  });

  if (selected.length < 6) {
    available.forEach((p) => {
      if (selected.length >= 6) return;
      if (!selected.some((item) => item.id === p.id)) {
        selected.push(p);
      }
    });
  }

  return selected.slice(0, 7);
}

/* =========================
   MAIN DASHBOARD
========================= */
export default function Dashboard({ onAddToCart }) {
  const navigate = useNavigate();
  const savedUser = typeof window !== 'undefined'
    ? (() => {
        try {
          return JSON.parse(localStorage.getItem('user') || '{}');
        } catch {
          return {};
        }
      })()
    : {};
  const userId = savedUser?.id || 0;
  const [products, setProducts] = useState([]);
  const [bestSellerProducts, setBestSellerProducts] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [recentCompletedOrder, setRecentCompletedOrder] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct]       = useState(null);
  const [isCustomCakeOpen, setIsCustomCakeOpen]     = useState(false);
  const favoritesStorageKey = `favorite_product_ids_${userId || 'guest'}`;

  const saveLocalFavorites = (next) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(favoritesStorageKey, JSON.stringify(next));
    }
  };

  const loadFavorites = async () => {
    if (userId > 0) {
      try {
        const response = await fetch(`${CUSTOMER_BASE}/api/favorites`, {
          credentials: 'include',
          headers: getAuthHeaders(),
        });
        const data = await safeParseJson(response);
        if (Array.isArray(data)) {
          setFavoriteIds(data.map(Number));
          return;
        }
      } catch (err) {
        console.error('Failed to load server favorites', err);
      }
    }

    const stored = typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem(favoritesStorageKey) || '[]')
      : [];
    setFavoriteIds(Array.isArray(stored) ? stored : []);
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res  = await fetch(`${CUSTOMER_BASE}/api/customer/products?action=list`);
        const data = await safeParseJson(res);
        if (Array.isArray(data)) setProducts(data);
      } catch (err) {
        console.error("Failed to load products:", err);
        setProducts([]);
      }
    };

    const fetchRecommendations = async () => {
      if (!userId) {
        setRecommendedProducts([]);
        return;
      }

      try {
        const res = await fetch(`${CUSTOMER_BASE}/api/customer/products?action=recommendations`, {
          credentials: 'include',
          headers: getAuthHeaders(),
        });
        const data = await safeParseJson(res);
        if (data?.success && Array.isArray(data.items)) {
          setRecommendedProducts(data.items);
        } else {
          setRecommendedProducts([]);
        }
      } catch (err) {
        console.error("Failed to load recommendations:", err);
        setRecommendedProducts([]);
      }
    };

    const fetchBestSellers = async () => {
      try {
        const res = await fetch(`${CUSTOMER_BASE}/api/customer/products?action=bestsellers`);
        const data = await safeParseJson(res);
        setBestSellerProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load best sellers:", err);
        setBestSellerProducts([]);
      }
    };

    const fetchRecentCompletedOrder = async () => {
      if (!userId) {
        setRecentCompletedOrder(null);
        return;
      }

      try {
        const res = await fetch(`${LARAVEL_BASE}/api/orders`, {
          credentials: 'include',
          headers: getAuthHeaders(),
        });
        const data = await safeParseJson(res);
        const completedOrder = (Array.isArray(data?.orders) ? data.orders : [])
          .filter((order) => String(order.status || '').toLowerCase() === 'completed')
          .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))[0] || null;
        setRecentCompletedOrder(completedOrder);
      } catch (err) {
        console.error("Failed to load recent completed order:", err);
        setRecentCompletedOrder(null);
      }
    };

    fetchProducts();
    fetchRecommendations();
    fetchBestSellers();
    fetchRecentCompletedOrder();
    loadFavorites();

    const recommendationInterval = setInterval(fetchRecommendations, 10000);
    const bestSellerInterval = setInterval(fetchBestSellers, 10000);
    return () => {
      clearInterval(recommendationInterval);
      clearInterval(bestSellerInterval);
    };
  }, [favoritesStorageKey, userId]);

  const handleAction = (product, size, price) => {
    setSelectedProduct({ ...product, variant: size, basePrice: price });
    setIsProductModalOpen(true);
  };

  const handleSelectProduct = (product, size, price) => {
    setSelectedProduct({ ...product, variant: size, basePrice: price });
    setIsProductModalOpen(true);
  };

  const cakeRecommendations = recommendedProducts.filter(isCakeProduct);
  const bestSellers = bestSellerProducts.filter(isCakeProduct);

  const mustTry = useMemo(() => buildMustTryList(products), [products]);
  const recentOrderItem = (() => {
    const item = recentCompletedOrder?.items?.[0];
    if (!item) return null;
    const catalogMatch = products.find((product) => (
      String(product.name || '').trim().toLowerCase() === String(item.name || '').trim().toLowerCase()
    ));
    return catalogMatch ? { ...catalogMatch, ...item } : item;
  })();
  const recentOrderImage = resolveCustomReferenceImage(recentCompletedOrder) || resolveProductImage(recentOrderItem);

  return (
    <div className="min-h-screen bg-[#fbfaf5] font-['DM_Sans'] relative">

      <Banner
        onShopNow={() => navigate("/customer/menu")}
        onCustomizeNow={() => navigate("/customer/customized-cakes")}
      />

      <main className="mx-auto max-w-[1380px] px-4 py-5 md:px-7 lg:px-10">
        <div className="mb-3 grid grid-cols-2 gap-2 px-1 py-1 sm:grid-cols-3 md:grid-cols-6 md:gap-3">
          {[
            ['Birthday', CakeSlice, '/customer/birthday-designs'],
            ['Cutesy', Sparkles, '/customer/cutesy-designs'],
            ['Holidays', Gift, '/customer/holiday-designs'],
            ['Kids Themes', Baby, '/customer/kids-designs'],
            ['Wedding', Heart, '/customer/wedding-designs'],
            ['Floral Designs', Flower2, '/customer/floral-designs'],
          ].map(([label, Icon, path]) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate(path)}
              className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-[#eee4de] bg-white px-2 py-3 text-center text-[#5f514a] transition hover:-translate-y-0.5 hover:border-[#e7c875] hover:bg-[#fff8df] hover:text-[#8d6a2e]"
            >
              <Icon size={22} strokeWidth={1.6} className="shrink-0" />
              <span className="w-full text-[10px] font-semibold leading-tight break-words">{label}</span>
            </button>
          ))}
        </div>

        <SecondaryBanner onOrderNow={() => navigate("/customer/customized-cakes")} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(300px,0.88fr)]">
          <div className="min-w-0">
            <section className="mb-4 overflow-hidden rounded-xl border border-[#eadfd8] bg-white shadow-[0_5px_18px_rgba(91,64,39,0.05)]">
              <div className="flex items-center justify-between border-b border-[#f0e7e0] px-4 py-3 sm:px-5">
                <div><p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#b17876]">Featured cakes</p><h2 className="mt-0.5 font-serif text-xl text-[#33251e] md:text-2xl">Our Best Sellers</h2></div>
                <button type="button" onClick={() => navigate('/customer/menu')} className="inline-flex items-center gap-1 text-[10px] font-bold text-[#765d50]">View All Cakes <ChevronRight size={13} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 xl:grid-cols-5">
                {(bestSellers.length ? bestSellers : mustTry).slice(0, 5).map((product) => <RecommendationCard key={product.id} product={product} onSelect={handleSelectProduct} />)}
              </div>
            </section>

            <section className="mb-4 rounded-xl border border-[#eadfd8] bg-white p-4 shadow-[0_5px_18px_rgba(91,64,39,0.04)] sm:p-5">
              <div className="mb-3 flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#b17876]">Curated for you</p><h2 className="mt-0.5 font-serif text-xl text-[#33251e]">Just for You</h2></div><button type="button" onClick={() => navigate('/customer/menu')} className="text-[10px] font-bold text-[#765d50]">View All <ChevronRight size={13} className="inline" /></button></div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(cakeRecommendations.length ? cakeRecommendations : mustTry).slice(0, 4).map((product) => <RecommendationCard key={product.id} product={product} onSelect={handleSelectProduct} />)}</div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-[#eadfd8] bg-white p-4 shadow-[0_5px_18px_rgba(91,64,39,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff8e9] text-[#a57c38]"><Gift size={19} /></span>
                  <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#9b7b3d]">Pastry Project Rewards</p><p className="mt-1 max-w-[190px] text-[13px] font-black leading-snug text-[#33251e]">Every order comes with a little extra.</p></div>
                </div>
                <button type="button" onClick={() => navigate('/customer/rewards')} className="shrink-0 rounded-lg bg-[#fff8e9] px-3 py-2 text-[9px] font-bold text-[#33251e] hover:bg-[#111111] hover:text-white">View Rewards</button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#eadfca] pt-3 text-center"><div><Star size={15} className="mx-auto text-[#a57c38]" /><p className="mt-1 text-[10px] font-bold text-[#33251e]">10 points</p><p className="text-[8px] text-[#74675f]">per ₱100</p></div><div><Gift size={15} className="mx-auto text-[#a57c38]" /><p className="mt-1 text-[10px] font-bold text-[#33251e]">1,000 points</p><p className="text-[8px] text-[#74675f]">5% OFF</p></div><div><Tag size={15} className="mx-auto text-[#a57c38]" /><p className="mt-1 text-[10px] font-bold text-[#33251e]">₱100 max</p><p className="text-[8px] text-[#74675f]">per reward</p></div></div>
            </section>

            <section className="rounded-xl border border-[#eadfd8] bg-white p-4 shadow-[0_5px_18px_rgba(91,64,39,0.04)]">
              <div className="mb-4 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5d4a42]">Your Order</p><button type="button" onClick={() => navigate('/customer/orders')} className="text-[10px] font-bold text-[#765d50]">View All Orders <ChevronRight size={12} className="inline" /></button></div>
              <div className="flex items-start justify-between text-center text-[10px] text-[#665b55]"><div className="flex flex-col items-center gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#e7c875] bg-[#fff8e9] text-[#a57c38]"><ClipboardList size={18} /></span><span className="font-semibold">Pending</span><small className="text-[9px] text-[#9b8c83]">Order received</small></div><span className="mt-5 h-px flex-1 bg-[#efd8d4]" /><div className="flex flex-col items-center gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfd8] bg-[#fffaf7] text-[#8e7b70]"><Gift size={18} /></span><span className="font-semibold">Processing</span><small className="text-[9px] text-[#9b8c83]">Baking your cake</small></div><span className="mt-5 h-px flex-1 bg-[#efd8d4]" /><div className="flex flex-col items-center gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfd8] bg-[#fffaf7] text-[#8e7b70]"><ChevronRight size={18} /></span><span className="font-semibold">Delivery</span><small className="text-[9px] text-[#9b8c83]">Almost there!</small></div></div>
            </section>

            <section className="rounded-xl border border-[#eadfd8] bg-white p-4 shadow-[0_5px_18px_rgba(91,64,39,0.04)]"><p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#5d4a42]">Quick Actions</p><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setIsCustomCakeOpen(true)} className="flex items-center gap-2 rounded-lg bg-[#fff0f0] px-3 py-3 text-left text-[10px] font-bold text-[#5b4540]"><Gift size={18} className="text-[#c36b77]" />Customize Cake</button><button type="button" onClick={() => navigate('/customer/orders')} className="flex items-center gap-2 rounded-lg bg-[#fff8e9] px-3 py-3 text-left text-[10px] font-bold text-[#5b4540]"><ClipboardList size={18} className="text-[#a57c38]" />View Orders</button><button type="button" onClick={() => navigate('/customer/profile')} className="flex items-center gap-2 rounded-lg bg-[#f7f2fb] px-3 py-3 text-left text-[10px] font-bold text-[#5b4540]"><User size={18} className="text-[#87699a]" />My Profile</button><button type="button" onClick={() => navigate('/customer/chat-support')} className="flex items-center gap-2 rounded-lg bg-[#eef7f4] px-3 py-3 text-left text-[10px] font-bold text-[#5b4540]"><MessageCircle size={18} className="text-[#668e83]" />Chat Support</button></div></section>

            <section className="relative min-h-[132px] overflow-hidden rounded-xl border border-[#eadfd8] bg-white p-3 text-[#3c2925] shadow-[0_5px_18px_rgba(91,64,39,0.04)]"><div className="absolute -right-7 -top-7 h-28 w-28 rounded-full border-[12px] border-[#f3e3b0]" /><div className="relative z-10 max-w-[220px]"><p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#a57c38]">Special Offer</p><h2 className="mt-1 font-serif text-3xl leading-none">10% OFF</h2><p className="mt-1 text-xs leading-5 text-[#765f3d]">on your next order. Treat yourself to something freshly baked.</p><button type="button" onClick={() => navigate('/customer/menu')} className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#33251e] px-4 py-1.5 text-[10px] font-bold text-white">Shop Now <ChevronRight size={12} /></button></div></section>
          </aside>
        </div>

        {recentCompletedOrder && recentOrderItem && <section className="mt-4 rounded-xl border border-[#eadfd8] bg-white p-4 shadow-[0_5px_18px_rgba(91,64,39,0.04)]"><div className="flex items-center justify-between"><h2 className="font-serif text-xl text-[#33251e]">Recent Order</h2><button type="button" onClick={() => navigate('/customer/orders')} className="text-[10px] font-bold text-[#765d50]">View Details <ChevronRight size={13} className="inline" /></button></div><div className="mt-3 flex items-center gap-3"><img src={recentOrderImage} alt={recentOrderItem.name || 'Completed order'} className="h-16 w-16 rounded-lg bg-[#f5eee5] object-contain p-1" /><div><h3 className="text-sm font-bold text-[#33251e]">{recentOrderItem.name}</h3><p className="text-xs text-[#9b8c83]">Order #{recentCompletedOrder.id} · {recentCompletedOrder.status || 'Completed'}</p></div></div></section>}
      </main>

      <TestimonialsSection />

      {/* STAFF-CUSTOMER CHAT */}
      <ChatBubble />

      {/* MODALS */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        product={selectedProduct}
        allCakes={products.filter(p => p.category === "Cakes")}
        onAddToCart={onAddToCart}
      />
      <CustomCakeModal
        isOpen={isCustomCakeOpen}
        onClose={() => setIsCustomCakeOpen(false)}
        allCakes={products.filter(p => p.category === "Cakes")}
        onAddToCart={onAddToCart}
      />
    </div>
  );
}
