import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Headphones, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import ProductCard from "../components/ProductCard";
import ProductModal from "../components/ProductModal";
import CustomCakeModal from "../components/CustomCakeModal";
import { CUSTOMER_BASE } from "../../services/config";
import { safeParseJson } from "../../services/api";

/* =========================
   HERO BANNER SLIDES
   First slide is a video, the rest are pastry photos.
   Swap the src values below for your own assets.
========================= */
const HERO_SLIDES = [
  {
    type: "video",
    src: "/assets/hero/pastry-process.mp4", // replace with your own video file
    poster: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=2000",
  },
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=2000",
  },
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1517433367423-c7e5b0f35086?q=80&w=2000",
  },
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1505253758473-96b7015fcd40?q=80&w=2000",
  },
];

function Banner({ onOrderClick }) {
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
    <div className="relative w-full h-screen min-h-[720px] bg-[#1a1a1a] flex items-center justify-center overflow-hidden font-['DM_Sans']">

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
              className="absolute inset-0 w-full h-full object-cover opacity-40"
              src={HERO_SLIDES[slide].src}
              poster={HERO_SLIDES[slide].poster}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <div
              className="absolute inset-0 opacity-40 bg-cover bg-center"
              style={{ backgroundImage: `url('${HERO_SLIDES[slide].src}')` }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* TEXT CONTENT */}
      <div className="relative z-10 text-center px-6 max-w-4xl">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[#d4af37] text-xs font-black tracking-[0.4em] uppercase mb-4"
        >
          Pastry Project by Chef Lawrence
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-white text-5xl md:text-6xl font-bold mb-8 leading-tight"
        >
          Baked Fresh,
          <br />
          <span className="italic text-[#d4af37]">Made with Love.</span>
        </motion.h1>
        <motion.button
          onClick={onOrderClick}
          whileHover={{ scale: 1.05 }}
          className="bg-[#d4af37] text-black px-12 py-4 rounded-full font-bold text-sm uppercase tracking-[0.2em] shadow-2xl"
        >
          Browse Menu
        </motion.button>
      </div>

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

function RecommendationCard({ product, onAddToCart }) {
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
    <div className="rounded-[30px] border border-stone-200 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
      <div className="mb-4 h-32 w-full overflow-hidden rounded-[22px] bg-stone-100">
        <img
          src={product.image ? `${CUSTOMER_BASE}/uploads/${product.image}` : 'https://via.placeholder.com/300'}
          alt={product.name}
          className="h-full w-full object-cover"
        />
      </div>

      <h3 className="text-base font-bold text-gray-800">{product.name}</h3>
      <p className="mt-2 text-sm font-semibold text-black">₱{Number(selectedPrice || 0).toLocaleString()}</p>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {sizeOptions.map((option) => {
          const label = String(option.size || 'Regular');
          const isSelected = selectedSize === label;
          return (
            <button
              key={`${product.id}-${label}`}
              type="button"
              onClick={() => setSelectedSize(label)}
              className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${
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

      <p className="mt-2 text-xs text-gray-500 line-clamp-2">
        {product.description || 'Freshly baked and customer favorite.'}
      </p>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
        {product.reason}
      </p>

      <button
        onClick={() => onAddToCart?.({
          ...product,
          qty: 1,
          price: Number(selectedPrice || product.price || 0),
          variant: selectedSize,
          size: selectedSize,
          basePrice: Number(selectedPrice || product.price || 0),
        })}
        className="mt-4 w-full rounded-xl bg-[#111827] py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white hover:bg-[#d4af37] hover:text-black"
      >
        Add to Cart
      </button>
    </div>
  );
}

/* =========================
   CHAT BUBBLE COMPONENT
========================= */
function ChatBubble() {
  const [open, setOpen]           = useState(false);
  const [step, setStep]           = useState("enter_order"); // enter_order | chatting
  const [orderId, setOrderId]     = useState("");
  const [orderError, setOrderError] = useState("");
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [sending, setSending]     = useState(false);
  const [unread, setUnread]       = useState(0);
  const [orderInput, setOrderInput] = useState("");
  const [selectedConcern, setSelectedConcern] = useState("");
  const bottomRef                 = useRef(null);
  const messagesContainerRef      = useRef(null);
  const pollRef                   = useRef(null);

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
    scrollToBottom();
  }, [messages, sending, step, open]);

  useEffect(() => {
    if (orderId) {
      setOrderInput(String(orderId));
    }
  }, [orderId]);

  /* Poll for new messages every 5s when chat is open */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (step === "chatting" && orderId) {
      fetchMessages();
      pollRef.current = setInterval(fetchMessages, 5000);
    }
    return () => clearInterval(pollRef.current);
  }, [step, orderId]);

  const fetchMessages = async () => {
    try {
      const res  = await fetch(`${CUSTOMER_BASE}/api_chat_fetch.php?order_id=${orderId}`);
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

  const handleOrderSubmit = async (customMessage = "") => {
    const id = parseInt((orderInput || orderId).toString().trim());
    setOrderError("");

    const initialMessage = (customMessage || input.trim() || selectedConcern || "Hi! I have a question.").trim();

    if (!id) {
      setOrderId("");
      setMessages([]);
      setStep("chatting");

      if (initialMessage) {
        await sendMessage(initialMessage, true, 0);
      }
      return;
    }

    setOrderId(String(id));

    // Verify order exists
    try {
      const res  = await fetch(`${CUSTOMER_BASE}/api_chat_fetch.php?order_id=${id}`);
      const data = await safeParseJson(res);
      if (data.success) {
        setMessages(data.messages);
        setStep("chatting");

        // Send the selected concern or a default greeting if this is the first chat
        if (data.messages.length === 0 && initialMessage) {
          await sendMessage(initialMessage, true, id);
        } else if (initialMessage) {
          setInput(initialMessage);
        }
      } else {
        setOrderError("Order not found. Please check your order number.");
      }
    } catch (e) {
      setOrderError("Could not connect. Please try again.");
    }
  };

  const sendMessage = async (text, silent = false, activeOrderId = parseInt(orderId)) => {
    const msg = text || input.trim();
    if (!msg) return;

    if (!silent) {
      setSending(true);
      setInput("");
      // Optimistic UI
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: "customer",
        message: msg,
        created_at: new Date().toISOString()
      }]);
    }

    const payloadOrderId = activeOrderId || parseInt(orderId) || 0;

    try {
      const res  = await fetch(`${CUSTOMER_BASE}/api_chat_send.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: payloadOrderId, message: msg, sender: "customer" })
      });
      const data = await safeParseJson(res);

      if (data.success && data.ai_reply) {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: "ai",
          message: data.ai_reply,
          created_at: new Date().toISOString()
        }]);
      } else if (!payloadOrderId) {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: "ai",
          message: "Thanks for reaching out! We’ll help with your question shortly.",
          created_at: new Date().toISOString()
        }]);
      }
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
    staff: "Staff",
    ai: "Pastry AI"
  };

  return (
    <>
      {/* FLOAT BUTTON */}
      <div className="fixed bottom-6 right-6 z-[60000] flex items-center gap-3">
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
            onClick={() => { setOpen(o => !o); setUnread(0); }}
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
      </div>

      {/* CHAT PANEL */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 w-[320px] sm:w-[340px] bg-white rounded-[20px] shadow-2xl z-[60001] flex flex-col overflow-hidden border border-gray-100"
            style={{ height: "480px" }}
          >
            {/* HEADER */}
            <div className="bg-black px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#d4af37] flex items-center justify-center flex-shrink-0">
                <Headphones size={16} className="text-black" />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">Pastry Project Support</p>
                <p className="text-gray-400 text-xs">
                  {step === "chatting" ? `Order #${orderId}` : "We usually reply instantly"}
                </p>
              </div>
              {step === "chatting" && (
                <button
                  onClick={() => { setStep("enter_order"); setMessages([]); setOrderId(""); }}
                  className="text-gray-400 hover:text-white text-xs underline"
                >
                  Change order
                </button>
              )}
            </div>

            {/* BODY */}
            {step === "enter_order" ? (

              /* WELCOME SCREEN */
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 gap-4 bg-gray-50 flex flex-col justify-start">
                <div className="rounded-[20px] border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#fdf8ec] flex items-center justify-center">
                      <MessageCircle size={20} className="text-[#d4af37]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Pastry Project Support</p>
                      <p className="text-xs text-gray-500">We’re here to help</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-[15px] font-semibold text-gray-900">Hi, {savedUser?.name || "there"}!</p>
                    <p className="mt-1 text-sm text-gray-600">How can we help you today?</p>
                  </div>

                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <div className="flex items-center justify-center text-[11px] uppercase tracking-[0.2em] text-gray-400">
                      ────────────────────────
                    </div>
                    <div className="mt-3 space-y-2">
                      {[
                        "Track My Order",
                        "Customized Cake Inquiry",
                        "Delivery Questions",
                        "Payment Assistance",
                        "Product Inquiry",
                        "Other Concern",
                      ].map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            setSelectedConcern(item);
                            setInput(item);
                            setOrderError("");
                          }}
                          className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                            selectedConcern === item
                              ? "border-[#d4af37] bg-[#fdf8ec] text-gray-900"
                              : "border-gray-200 bg-gray-50 text-gray-700 hover:border-[#d4af37] hover:bg-[#fdf8ec]"
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-center text-[11px] uppercase tracking-[0.2em] text-gray-400">
                      ────────────────────────
                    </div>
                  </div>

                  <div className="mt-2">
                    <label className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Order number (optional)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={orderInput}
                      onChange={(e) => setOrderInput(e.target.value)}
                      placeholder="e.g. 123"
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-[#d4af37]"
                    />
                  </div>

                  {orderError && (
                    <p className="text-xs text-red-500">{orderError}</p>
                  )}

                  <button
                    onClick={() => handleOrderSubmit(input.trim() || selectedConcern)}
                    className="mt-2 w-full bg-black text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#d4af37] hover:text-black transition-colors"
                  >
                    Start Chat
                  </button>
                </div>
              </div>

            ) : (

              /* MESSAGES */
              <>
                <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5 bg-gray-50">
                  {messages.length === 0 && (
                    <div className="text-center text-gray-400 text-xs pt-8">
                      No messages yet. Say hi!
                    </div>
                  )}

                  {messages.map((msg, i) => {
                    const isCustomer = msg.sender === "customer";
                    const isAi       = msg.sender === "ai";

                    return (
                      <div key={msg.id ?? i} className={`flex gap-2 ${isCustomer ? "flex-row-reverse" : "flex-row"}`}>
                        {/* Avatar */}
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
                            {msg.message}
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

                {/* INPUT */}
                <div className="px-3 py-2.5 border-t border-gray-100 bg-white flex gap-2 items-end">
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
                    disabled={!input.trim() || sending}
                    className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-[#d4af37] transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* =========================
   MAIN DASHBOARD
========================= */
export default function Dashboard({ onAddToCart }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct]       = useState(null);
  const [isCustomCakeOpen, setIsCustomCakeOpen]     = useState(false);

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

    fetchProducts();
    fetchRecommendations();
    loadFavorites();
  }, [favoritesStorageKey, userId]);

  const handleAction = (product, size, price) => {
    setSelectedProduct({ ...product, variant: size, basePrice: price });
    setIsProductModalOpen(true);
  };

  const handleSelectProduct = (product, size, price) => {
    setSelectedProduct({ ...product, variant: size, basePrice: price });
    setIsProductModalOpen(true);
  };

  const bestSellers = useMemo(() =>
    products.filter(p => !p.name?.toLowerCase().includes("customization")).slice(0, 6),
  [products]);

  const mustTry = useMemo(() => {
    const targets = [
      "ube flan cake",
      "sansrival",
      "tuna pasta",
      "cheesy bacon fries",
      "mojos hot",
      "breakfast pizza"
    ];

    const available = products
      .filter(p => p.name)
      .map(p => ({ ...p, lowerName: p.name.toLowerCase() }));

    const selected = [];
    targets.forEach(target => {
      const match = available.find(p => p.lowerName.includes(target));
      if (match && !selected.some(item => item.id === match.id)) {
        selected.push(match);
      }
    });

    available.forEach(p => {
      if (selected.length >= 6) return;
      if (!p.lowerName.includes("customization") && !selected.some(item => item.id === p.id)) {
        selected.push(p);
      }
    });

    return selected;
  }, [products]);

  return (
    <div className="bg-white min-h-screen font-['DM_Sans'] relative">

      <Banner onOrderClick={() => navigate("/customer/menu")} />

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-10">

        {/* CUSTOM CAKE */}
        <div className="relative w-full h-[350px] rounded-[50px] overflow-hidden group bg-black shadow-2xl mb-20">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-60 group-hover:scale-110 transition-transform duration-1000"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1535141192574-5d4897c12636?q=80&w=2000')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent flex items-center px-16">
            <div className="max-w-md">
              <h2 className="text-white text-4xl font-bold mb-4">
                Want to customize <br />
                <span className="text-[#d4af37]">your cake?</span>
              </h2>
              <p className="text-gray-300 text-sm mb-8">
                Choose flavors, tiers, and design. We'll bake it your way.
              </p>
              <button
                onClick={() => navigate("/customer/customized-cakes")}
                className="bg-white text-black px-10 py-4 rounded-full font-black text-sm uppercase tracking-widest hover:bg-[#d4af37]"
              >
                Customize Now
              </button>
            </div>
          </div>
        </div>

        {recommendedProducts.length > 0 && (
          <section className="mb-20">
            <div className="flex justify-between mb-10">
              <div>
                <p className="text-[#d4af37] text-xs uppercase tracking-[0.4em] font-black">Smart Picks</p>
                <h2 className="text-3xl font-bold">✨ Recommended for You</h2>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
              {recommendedProducts.map((product) => (
                <RecommendationCard
                  key={product.id}
                  product={product}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          </section>
        )}

        {/* BEST SELLERS */}
        <section className="mb-20">
          <div className="flex justify-between mb-10">
            <div>
              <p className="text-[#d4af37] text-xs uppercase tracking-[0.4em] font-black">Customer Favorites</p>
              <h2 className="text-3xl font-bold">Best Sellers</h2>
            </div>
            <button onClick={() => navigate("/customer/menu")} className="text-xs uppercase tracking-[0.3em] text-gray-400 hover:text-black font-semibold">
              View Menu
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
            {bestSellers.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              onAction={handleAction}
              onSelect={handleSelectProduct}
              favorite={favoriteIds.includes(Number(p.id))}
              onToggleFavorite={async (product) => {
                const id = Number(product.id);
                const currentlyFavorite = favoriteIds.includes(id);
                const next = currentlyFavorite
                  ? favoriteIds.filter(itemId => itemId !== id)
                  : [...favoriteIds, id];
                setFavoriteIds(next);
                if (userId > 0) {
                  try {
                    await fetch(`${CUSTOMER_BASE}/api_favorites.php`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ user_id: userId, product_id: id, favorite: !currentlyFavorite }),
                    });
                  } catch (err) {
                    console.error('Failed to save favorite to server', err);
                  }
                } else {
                  saveLocalFavorites(next);
                }
              }}
            />
          ))}
          </div>
        </section>

        {/* MUST TRY */}
        <section className="pb-10">
          <div className="flex justify-between mb-10">
            <div>
              <p className="text-[#d4af37] text-xs uppercase tracking-[0.4em] font-black">Chef Recommendation</p>
              <h2 className="text-3xl font-bold">Must Try</h2>
            </div>
            <button onClick={() => navigate("/customer/menu")} className="text-xs uppercase tracking-[0.3em] text-gray-400 hover:text-black font-semibold">
              Explore More
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
            {mustTry.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              onAction={handleAction}
              onSelect={handleSelectProduct}
              favorite={favoriteIds.includes(Number(p.id))}
              onToggleFavorite={async (product) => {
                const id = Number(product.id);
                const currentlyFavorite = favoriteIds.includes(id);
                const next = currentlyFavorite
                  ? favoriteIds.filter(itemId => itemId !== id)
                  : [...favoriteIds, id];
                setFavoriteIds(next);
                if (userId > 0) {
                  try {
                    await fetch(`${CUSTOMER_BASE}/api_favorites.php`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ user_id: userId, product_id: id, favorite: !currentlyFavorite }),
                    });
                  } catch (err) {
                    console.error('Failed to save favorite to server', err);
                  }
                } else {
                  saveLocalFavorites(next);
                }
              }}
            />
          ))}
          </div>
        </section>
      </div>

      {/* CHAT BUBBLE */}
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
