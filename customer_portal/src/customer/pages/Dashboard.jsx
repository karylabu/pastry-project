import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Headphones, Paperclip, ArrowLeft, Phone, Plus, History, ChevronLeft, ChevronRight, Gift, Star, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";

import ProductModal from "../components/ProductModal";
import CustomCakeModal from "../components/CustomCakeModal";
import { CUSTOMER_BASE, ROOT_BASE } from "../../services/config";
import { safeParseJson } from "../../services/api";

/* =========================
   HERO BANNER SLIDES
  First slide uses the uploaded banner image, followed by pastry photos.
   Swap the src values below for your own assets.
========================= */
const HERO_SLIDES = [
  {
    type: "image",
    src: "http://localhost/pastry-project/uploads/banner(1).png",
  },
  {
    type: "video",
    src: "http://localhost/pastry-project/uploads/banner%282%29.mp4",
  },
];

function Banner({ onShopNow, onCustomizeNow }) {
  const [slide, setSlide] = useState(0);
  const total = HERO_SLIDES.length;

  const goTo = (i) => setSlide(((i % total) + total) % total);
  const next = () => goTo(slide + 1);
  const prev = () => goTo(slide - 1);

  // auto-advance every 6s, paused while the video slide is showing
  useEffect(() => {
    if (HERO_SLIDES[slide].type === "video") return;
    const t = setTimeout(next, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide]);

  return (
    <div className="relative aspect-[4/1] w-full bg-white flex items-center justify-center overflow-hidden font-['DM_Sans']">

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
          {HERO_SLIDES[slide].type === "video" ? (
            <video
              className="absolute inset-0 w-full h-full object-contain"
              src={HERO_SLIDES[slide].src}
              poster={HERO_SLIDES[slide].poster}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img
              src={HERO_SLIDES[slide].src}
              alt="Pastry Project banner"
              className="absolute inset-0 h-full w-full object-contain"
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

      {/* PREV / NEXT ARROWS */}
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

      {/* DOT INDICATORS */}
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
    </div>
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

const productImageUrl = (filename) => `${ROOT_BASE}/uploads/${filename}?v=transparent-v26`;

const getCategoryFallbackImage = (category = '') => {
  const normalizedCategory = String(category || '').trim().toLowerCase();

  if (normalizedCategory.includes('coffee')) return `${ROOT_BASE}/uploads/americano.png`;
  if (normalizedCategory.includes('drink')) return `${ROOT_BASE}/uploads/caramel.png`;
  if (normalizedCategory.includes('pizza')) return `${ROOT_BASE}/uploads/pepperoni.png`;
  if (normalizedCategory.includes('starter')) return `${ROOT_BASE}/uploads/chicken.png`;

  return `${ROOT_BASE}/uploads/americano.png`;
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
  const shouldEnlargeDrinkSize = /\b(strawberry fruit tea|matcha|vanilla|mango ade|blueberry ade|blueberry fizz|strawberry fizz|passion fruit tea|kiwi fruit tea)\b/i.test(normalizedProductName);
  const isSmallCoffeeProduct = /\b(matcha latte|vanilla|white chocolate)\b/i.test(normalizedProductName) && /\bcoffee\b/i.test(String(product?.category || ''));

  const sizeOptions = Array.isArray(product?.sizes) && product.sizes.length > 0
    ? product.sizes
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
    <div className="flex h-full min-h-[290px] min-w-0 flex-col rounded-[20px] border border-stone-200 bg-white p-2 shadow-[0_8px_20px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
      <div className="mb-3 flex h-[146px] w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-stone-100 bg-[#f7f5f2] p-2">
        <img
          src={resolveProductImage(product)}
          alt={product.name}
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = fallbackImage;
          }}
          className={
            shouldEnlargeDrinkSize || isSmallCoffeeProduct
              ? `h-[120px] w-auto max-w-[82%] max-h-[120px] object-contain object-center transition-transform duration-500 ${isSmallCoffeeProduct ? 'scale-110' : 'scale-105'}`
              : product?.category && /\b(cake|cakes|meal|meals|pasta|starter|starters)\b/i.test(String(product.category))
                ? 'h-[104px] w-auto max-w-[72%] max-h-[104px] object-contain object-center transition-transform duration-500 scale-100'
                : 'h-[120px] w-auto max-w-[82%] max-h-[120px] object-contain object-center transition-transform duration-500 scale-100'
          }
                  style={isStarterProduct ? { mixBlendMode: 'multiply' } : undefined}
        />
      </div>

      <h3 className="min-h-[1.6rem] line-clamp-2 text-[12px] font-bold leading-tight text-gray-800">{product.name}</h3>
      <p className="mt-1 text-[12px] font-semibold text-black">₱{Number(selectedPrice || 0).toLocaleString()}</p>

      <div className="mt-1 flex flex-wrap justify-center gap-1">
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

      <p className="mt-1 text-[9.5px] text-gray-500 line-clamp-2">
        {product.description || 'Freshly baked and customer favorite.'}
      </p>
      <p className="mt-1 text-[7.5px] font-semibold uppercase tracking-[0.14em] text-[#d4af37]">
        {product.reason}
      </p>

      <button
        onClick={() => onSelect?.(product, selectedSize, Number(selectedPrice || product.price || 0))}
        className="mt-auto h-8 w-full rounded-[10px] bg-[#111827] py-2 text-[8.5px] font-semibold uppercase tracking-[0.15em] text-white transition-colors hover:bg-[#d4af37] hover:text-black"
      >
        Add to Cart
      </button>
    </div>
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

  /* Poll for new messages every 5s when chat is open */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (step === "chatting") {
      fetchMessages();
      pollRef.current = setInterval(fetchMessages, 5000);
    }
    return () => clearInterval(pollRef.current);
  }, [step, conversationId, showHistory]);

  const fetchMessages = async () => {
    try {
      const params = new URLSearchParams({
        order_id: "0",
        user_id: String(savedUser?.id || 0),
        conversation_id: conversationId
      });
      const res  = await fetch(`${CUSTOMER_BASE}/api_chat_fetch.php?${params.toString()}`);
      const data = await safeParseJson(res);
      if (data.success) {
        setMessages(data.messages);
        if (!open) {
          const newStaff = data.messages.filter(m => m.sender !== "customer").length;
          setUnread(newStaff);
        }
      }
    } catch (e) {
      console.error("Chat fetch error:", e);
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
      // Optimistic UI
      setMessages(prev => [...prev, {
        id: Date.now(),
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
      formData.append("user_id", savedUser?.id || 0);
      formData.append("message", msg);
      formData.append("sender", "customer");
      formData.append("support_mode", "admin");
      formData.append("conversation_id", conversationId);
      if (image) formData.append("image", image);

      const chatApiBase = CUSTOMER_BASE;
      const res  = await fetch(`${chatApiBase}/api_chat_send.php`, {
        method: "POST",
        body: formData
      });
      const data = await safeParseJson(res);

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Message could not be sent");
      }

      await fetchMessages();
    } catch (e) {
      console.error("Send error:", e);
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
              if (!open) startFreshChat();
              setOpen(o => !o);
              setUnread(0);
            }}
            className="bg-black text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:bg-[#d4af37] transition-colors"
          >
            {open ? <X size={20} /> : <MessageCircle size={22} />}
          </button>
          {unread > 0 && !open && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
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
              ? "relative w-full min-h-[calc(100vh-180px)] bg-[#f7f7f7] flex flex-col overflow-hidden"
              : "fixed bottom-24 right-6 w-[calc(100vw-2rem)] max-w-[460px] sm:w-[460px] bg-white rounded-[20px] shadow-2xl z-[60001] flex flex-col overflow-hidden border border-gray-100"}
            style={fullPage ? undefined : { height: aiMode ? "min(620px, calc(100vh - 7rem))" : "min(500px, calc(100vh - 7rem))" }}
          >
            {/* HEADER */}
            <div className={fullPage ? "bg-[#fffdfa] px-4 py-4 sm:px-8 sm:py-5 flex items-center gap-3 sm:gap-4 border-b border-[#eadfd4]" : "bg-black px-5 py-4 flex items-center gap-3"}>
              {fullPage && (
                  <button type="button" onClick={() => setShowHistory(value => !value)} title={showHistory ? "Back to chat" : "View chat history"} aria-label={showHistory ? "Back to chat" : "View chat history"} className="w-9 h-9 rounded-full text-gray-500 hover:bg-gray-100 flex items-center justify-center">
                  <ArrowLeft size={20} />
                </button>
              )}
              <div className={fullPage ? "w-11 h-11 rounded-2xl bg-[#fff0e8] flex items-center justify-center flex-shrink-0" : "w-9 h-9 rounded-full bg-[#d4af37] flex items-center justify-center flex-shrink-0"}>
                <Headphones size={fullPage ? 20 : 16} className={fullPage ? "text-[#e45f32]" : "text-black"} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={fullPage ? "text-gray-900 font-bold text-lg sm:text-xl" : "text-white font-semibold text-sm"}>{fullPage ? (showHistory ? "Chat History" : "Customer Service") : "Admin Support"}</p>
                  {fullPage && !showHistory && <span className="hidden rounded-full bg-[#e8f5e9] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#398347] sm:inline-flex">Online</span>}
                </div>
                <p className={fullPage ? "text-gray-500 text-xs mt-0.5" : "text-gray-400 text-xs"}>
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
                    className="w-8 h-8 rounded-full text-gray-400 hover:bg-white/10 hover:text-white flex items-center justify-center"
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
                <div className="flex-1 overflow-y-auto bg-gray-50 px-5 py-6 sm:px-10">
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
                className={showHistory ? "hidden" : "flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5 bg-gray-50"}
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

                  return (
                    <div key={msg.id ?? i} className={`flex gap-2 ${isCustomer ? "flex-row-reverse" : "flex-row"}`}>
                      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold
                        ${isCustomer ? "bg-black text-white" : isAi ? "bg-[#d4af37] text-black" : "bg-purple-100 text-purple-700"}`}>
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
                            ? "bg-[#fdf8ec] text-gray-800 border border-[#f0e4b8] rounded-tl-sm"
                            : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm"
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
                  );
                })}

                {sending && (
                  <div className="flex gap-2 items-center">
                    <div className="w-7 h-7 rounded-full bg-[#d4af37] flex items-center justify-center">
                      <Bot size={12} className="text-black" />
                    </div>
                    <div className="bg-[#fdf8ec] border border-[#f0e4b8] px-4 py-2 rounded-2xl rounded-tl-sm">
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-[#d4af37] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-[#d4af37] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-[#d4af37] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {!showHistory && (
                <>
                  <div className="border-t border-gray-100 bg-white px-3 pt-2.5">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Quick chats</p>
                    <div className="flex flex-wrap gap-2">
                      {["Hi, I need help", "Where is my order?", "I want to place an order", "Can I customize a cake?", "How can I pay?"].map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => sendMessage(suggestion)}
                          disabled={sending}
                          className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] text-gray-600 transition hover:border-black hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
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
                      className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-black max-h-20"
                    />
                    <button
                      onClick={() => sendMessage()}
                      disabled={(!input.trim() && !selectedImage) || sending}
                      className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-[#d4af37] transition-colors"
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
                className="flex-1 rounded-xl bg-black px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#d4af37] hover:text-black"
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
  const welcomeKey = userId ? `pastry_project_welcome_modal_seen_${userId}` : 'pastry_project_welcome_modal_seen_guest';
  const [products, setProducts] = useState([]);
  const [bestSellerProducts, setBestSellerProducts] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [recentCompletedOrder, setRecentCompletedOrder] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct]       = useState(null);
  const [isCustomCakeOpen, setIsCustomCakeOpen]     = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(welcomeKey);
  });

  const closeWelcomeModal = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(welcomeKey, '1');
    }
    setIsWelcomeOpen(false);
  };
  const favoritesStorageKey = `favorite_product_ids_${userId || 'guest'}`;

  const saveLocalFavorites = (next) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(favoritesStorageKey, JSON.stringify(next));
    }
  };

  const loadFavorites = async () => {
    if (userId > 0) {
      try {
        const response = await fetch(`${CUSTOMER_BASE}/api_favorites.php?user_id=${userId}`);
        const data = await safeParseJson(response);
        if (data.status === 'success') {
          setFavoriteIds(data.favorites || []);
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
        const res  = await fetch(`${CUSTOMER_BASE}/api_products.php?action=list`);
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
        const res = await fetch(`${CUSTOMER_BASE}/api_products.php?action=recommendations&user_id=${userId}`);
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
        const res = await fetch(`${CUSTOMER_BASE}/api_products.php?action=bestsellers`);
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
        const res = await fetch(`${CUSTOMER_BASE}/api_get_orders.php?user_id=${userId}`);
        const data = await safeParseJson(res);
        const completedOrder = (Array.isArray(data) ? data : [])
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

      {isWelcomeOpen && (
        <div className="fixed inset-0 z-[50000] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title">
          <div className="relative w-full max-w-[820px] overflow-hidden rounded-[18px] border border-[#d8c28c] bg-[#F3EBDD] shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
            <button type="button" onClick={closeWelcomeModal} aria-label="Close welcome promotion" className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[#332923] shadow-sm transition hover:bg-[#1a1a1a] hover:text-white">
              <X size={18} />
            </button>
            <div className="flex flex-col items-center justify-center px-7 py-9 text-center md:flex-row md:gap-8 md:px-12 md:py-10 md:text-left">
              <div className="relative flex shrink-0 items-center justify-center md:h-[290px] md:w-[290px]">
                <span className="absolute left-4 top-8 h-3 w-3 rotate-45 bg-[#c59a36] opacity-70" />
                <span className="absolute bottom-8 right-5 h-2 w-2 rotate-45 bg-[#c59a36] opacity-70" />
                <img src="http://localhost/pastry-project/uploads/giftbox.png?v=welcome-v2" alt="Gold gift box" className="h-44 w-44 rounded-[18px] object-cover shadow-[0_12px_28px_rgba(111,76,24,0.12)] md:h-[290px] md:w-[290px]" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col items-center md:items-start">
                <p className="text-[9px] font-bold uppercase tracking-[0.42em] text-[#a9853b]">A little welcome treat</p>
                <h1 id="welcome-modal-title" className="mt-1 font-serif text-4xl font-black tracking-tight text-[#2c241f] md:text-5xl">WELCOME TO PASTRY PROJECT!</h1>
                <button type="button" onClick={closeWelcomeModal} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1a1a1a] px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-[#c59a36] hover:text-[#171717]">Continue shopping <ChevronRight size={15} /></button>
                <div className="my-4 flex items-center gap-2 text-[#c59a36]" aria-hidden="true"><span className="h-px w-14 bg-[#d8bd79]" /><span className="h-1.5 w-1.5 rounded-full bg-current" /><span className="h-px w-14 bg-[#d8bd79]" /></div>
                <p className="text-xl font-medium text-[#2b2927] md:text-2xl">Enjoy <span className="font-black text-[#bd9028]">FREE DELIVERY</span></p>
                <p className="mt-1 text-base text-[#4a4642] md:text-lg">on your <strong className="italic">first delivery order.</strong></p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Banner
        onShopNow={() => navigate("/customer/menu")}
        onCustomizeNow={() => navigate("/customer/customized-cakes")}
      />

      <main className="mx-auto max-w-[1380px] px-4 py-7 md:px-7 lg:px-10">
        <section className="mb-8 grid gap-4 rounded-2xl border border-[#e7dfd0] bg-[#fbf7f0] px-5 py-5 shadow-[0_6px_18px_rgba(91,64,39,0.04)] md:grid-cols-[1.35fr_0.8fr_0.9fr_0.9fr_auto] md:items-center md:gap-0 md:px-6 md:py-4">
          <div className="flex items-center gap-4 md:border-r md:border-[#e7dfd0] md:pr-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#ead9bd] text-[#33251e]"><Gift size={27} strokeWidth={1.7} /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9b7b3d]">Pastry Project Rewards</p>
              <p className="mt-1 text-xl font-black leading-tight text-[#33251e]">Every order comes<br className="hidden lg:block" /> with a little extra.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 md:justify-center md:border-r md:border-[#e7dfd0] md:px-5">
            <Star size={21} strokeWidth={1.6} className="text-[#9b7b3d]" />
            <div><p className="text-base font-black text-[#33251e]">10 points</p><p className="text-[11px] text-[#74675f]">Earn for every<br />₱100 spent.</p></div>
          </div>
          <div className="flex items-center gap-3 md:justify-center md:border-r md:border-[#e7dfd0] md:px-5">
            <Gift size={21} strokeWidth={1.6} className="text-[#9b7b3d]" />
            <div><p className="text-base font-black text-[#33251e]">1,000 points</p><p className="text-[11px] text-[#74675f]">Redeem for<br />5% OFF.</p></div>
          </div>
          <div className="flex items-center gap-3 md:justify-center md:px-5">
            <Tag size={21} strokeWidth={1.6} className="text-[#9b7b3d]" />
            <div><p className="text-base font-black text-[#33251e]">₱100 maximum</p><p className="text-[11px] text-[#74675f]">Discount cap<br />per reward.</p></div>
          </div>
          <button type="button" onClick={() => navigate('/customer/rewards')} className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#211914] px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white hover:bg-black md:ml-2">
            My Rewards <ChevronRight size={13} />
          </button>
        </section>

        <section className="mb-9">
          <div className="mb-4 flex items-end justify-between border-b border-[#e7dfd0] pb-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#9b7b3d]">Curated for you</p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-[#33251e] md:text-3xl">Just for You</h2>
              <p className="mt-1 text-xs text-[#9b8c83]">Our customers' top picks. You might love these!</p>
            </div>
            <button type="button" onClick={() => navigate('/customer/menu')} className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6f5844] hover:text-black">
              View all cakes <ChevronRight size={13} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            {(cakeRecommendations.length ? cakeRecommendations : bestSellers).slice(0, 4).map((product) => (
              <RecommendationCard key={product.id} product={product} onSelect={handleSelectProduct} />
            ))}
          </div>
        </section>

        <section className="mb-9">
          <div className="mb-4 flex items-end justify-between border-b border-[#e7dfd0] pb-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#9b7b3d]">Customer favorites</p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-[#33251e] md:text-3xl">Best Sellers</h2>
            </div>
            <button type="button" onClick={() => navigate('/customer/menu')} className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6f5844] hover:text-black">
              View all cakes <ChevronRight size={13} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            {bestSellers.slice(0, 6).map((product) => (
              <RecommendationCard key={product.id} product={product} onSelect={handleSelectProduct} />
            ))}
          </div>
        </section>

        <section className="mb-9">
          <div className="mb-4 flex items-end justify-between border-b border-[#e7dfd0] pb-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#9b7b3d]">Chef recommendation</p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-[#33251e] md:text-3xl">Must Try</h2>
            </div>
            <button type="button" onClick={() => navigate('/customer/menu')} className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6f5844] hover:text-black">
              Explore menu <ChevronRight size={13} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            {mustTry.slice(0, 6).map((product) => (
              <RecommendationCard key={product.id} product={product} onSelect={handleSelectProduct} />
            ))}
          </div>
        </section>

        <section className="grid gap-4 pb-5 md:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl border border-[#e7dfd0] bg-white p-4 shadow-[0_8px_22px_rgba(91,64,39,0.05)] sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-1 w-7 rounded-full bg-[#b9955d]" />
                <h2 className="font-serif text-xl font-bold text-[#33251e]">Recent Order</h2>
              </div>
              <button type="button" onClick={() => navigate('/customer/orders')} className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6f5844] hover:text-black">
                View All Orders <ChevronRight size={13} />
              </button>
            </div>
            {recentCompletedOrder && recentOrderItem ? (
              <div className="flex flex-col gap-4 rounded-xl border border-[#f0e9df] bg-[#fdfcf9] p-3 sm:flex-row sm:items-center sm:px-4">
                <img src={recentOrderImage} alt={recentOrderItem.name || 'Completed order'} className="h-20 w-20 shrink-0 rounded-xl bg-[#f5eee5] object-contain p-1" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold text-[#33251e]">{recentOrderItem.name || 'Your recent order'}</h3>
                  <p className="mt-1 text-sm font-semibold text-[#33251e]">₱{Number(recentCompletedOrder.total || recentOrderItem.price || 0).toLocaleString()}</p>
                  <p className="mt-1 text-xs text-[#9b8c83]">Order #{recentCompletedOrder.id} <span className="mx-1">·</span> {recentCompletedOrder.created_at ? new Date(recentCompletedOrder.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}</p>
                </div>
                <div className="flex items-center gap-3 sm:ml-auto">
                  <span className="rounded-full bg-[#fff0c7] px-4 py-2 text-xs font-semibold text-[#a47729]">{recentCompletedOrder.status || 'Completed'}</span>
                  <button type="button" onClick={() => navigate('/customer/orders')} className="rounded-full border border-[#d9c9b8] px-4 py-2 text-xs font-semibold text-[#6f5844] hover:bg-[#f8f1e8]">View Details</button>
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[#e7dfd0] px-4 py-7 text-center text-xs text-[#9b8c83]">No completed orders yet.</p>
            )}
          </div>
          <div className="relative min-h-[150px] overflow-hidden rounded-2xl border border-[#d3b58e] bg-[#f3e5d1] px-6 py-5 text-[#33251e] shadow-[0_8px_22px_rgba(91,64,39,0.06)]">
            <div className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rotate-12 border-[18px] border-[#e5cba8] opacity-70" />
            <div className="pointer-events-none absolute bottom-0 right-0 h-3 w-2/5 bg-[#c79c67] opacity-35" />
            <div className="relative z-10 max-w-[310px]">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#87633e]">A sweet little extra</p>
              <h2 className="mt-1 font-serif text-2xl font-bold leading-tight">Enjoy <span className="text-[#8f5f32]">10% Off</span><br />Your Next Order</h2>
              <p className="mt-1 text-xs text-[#806c59]">Treat yourself to something freshly baked.</p>
              <button type="button" onClick={() => navigate('/customer/menu')} className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#33251e] px-4 py-2 text-[10px] font-bold text-white shadow-sm hover:bg-[#5b3b28]">
                Shop now <ChevronRight size={12} />
              </button>
            </div>
            <div className="absolute bottom-4 right-6 z-10 hidden text-right sm:block">
              <p className="font-serif text-5xl font-black leading-none text-[#8f5f32]">10%</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-[#87633e]">off your order</p>
            </div>
          </div>
        </section>
      </main>

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
