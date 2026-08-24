import React, { useEffect, useState, useRef } from "react";
import { X, Send } from "lucide-react";
import { CUSTOMER_BASE } from "../../services/config";
import { safeParseJson } from '../../services/api';

const BASE = CUSTOMER_BASE;

export default function OrderChat({ order, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef(null);
  const intervalRef = useRef(null);

  const orderId = order?.id; // safe reference

  /* =========================
     LOAD MESSAGES
  ========================= */
  const fetchMessages = async () => {
    if (!orderId) return;

    try {
      const res = await fetch(
        `${BASE}/api_chat.php?order_id=${orderId}`
      );
      const data = await safeParseJson(res);
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Chat load error:", err);
    }
  };

  /* =========================
     INIT CHAT
  ========================= */
  useEffect(() => {
    if (!orderId) return;

    fetchMessages();

    intervalRef.current = setInterval(fetchMessages, 3000);

    return () => clearInterval(intervalRef.current);
  }, [orderId]);

  /* =========================
     AUTO SCROLL
  ========================= */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* =========================
     SEND MESSAGE
  ========================= */
  const sendMessage = async () => {
    if (!text.trim() || !orderId) return;

    setLoading(true);

    try {
      const res = await fetch(`${BASE}/api_chat_send.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          message: text,
          sender: "customer",
        }),
      });

      const result = await safeParseJson(res);

      if (result?.success) {
        setText("");
        fetchMessages();
      }
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-[9999]">
      <div className="w-full md:w-[420px] h-[600px] bg-white rounded-t-2xl md:rounded-2xl flex flex-col overflow-hidden">

        {/* HEADER */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <p className="text-xs text-gray-400">Order Chat</p>
            <h2 className="font-semibold">
              #{orderId}
            </h2>
          </div>

          <button onClick={onClose}>
            <X />
          </button>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
          {messages.length === 0 ? (
            <p className="text-center text-gray-400 text-sm mt-10">
              No messages yet
            </p>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[75%] p-2 rounded-lg text-sm ${
                  msg.sender === "customer"
                    ? "ml-auto bg-black text-white"
                    : "mr-auto bg-white border"
                }`}
              >
                {msg.message}
                <p className="text-[10px] opacity-60 mt-1">
                  {msg.created_at}
                </p>
              </div>
            ))
          )}

          <div ref={bottomRef} />
        </div>

        {/* INPUT */}
        <div className="p-3 border-t flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type message..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-black text-white px-3 rounded-lg disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}