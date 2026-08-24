import React, { useEffect, useState, useRef } from "react";
import { X, Send } from "lucide-react";

export default function OrderChatPanel({ order, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  // fallback order safety (prevents crash)
  const orderId = order?.id;

  /* =========================
     LOAD MESSAGES (LOCAL ONLY)
  ========================= */
  useEffect(() => {
    if (!orderId) return;

    // TEMP: load from localStorage (since no API yet)
    const saved = localStorage.getItem(`chat_${orderId}`);
    if (saved) {
      setMessages(JSON.parse(saved));
    } else {
      setMessages([]);
    }
  }, [orderId]);

  /* =========================
     AUTO SCROLL
  ========================= */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* =========================
     SEND MESSAGE (LOCAL STORAGE)
  ========================= */
  const sendMessage = () => {
    if (!text.trim() || !orderId) return;

    const newMsg = {
      message: text,
      sender: "customer",
      created_at: new Date().toLocaleTimeString(),
    };

    const updated = [...messages, newMsg];

    setMessages(updated);
    localStorage.setItem(`chat_${orderId}`, JSON.stringify(updated));

    setText("");
  };

  /* =========================
     SAFETY CHECK
  ========================= */
  if (!orderId) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-[9999]">
      
      <div className="w-[380px] h-full bg-white shadow-2xl flex flex-col">

        {/* HEADER */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <p className="text-xs text-gray-400">Order Chat</p>
            <h2 className="font-semibold">#{orderId}</h2>
          </div>

          <button onClick={onClose}>
            <X />
          </button>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
          
          {messages.length === 0 && (
            <p className="text-gray-400 text-sm text-center mt-10">
              No messages yet. Start the conversation.
            </p>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[75%] p-2 rounded-lg text-sm ${
                msg.sender === "customer"
                  ? "ml-auto bg-black text-white"
                  : "mr-auto bg-white border"
              }`}
            >
              {msg.message}

              {msg.created_at && (
                <p className="text-[10px] opacity-60 mt-1">
                  {msg.created_at}
                </p>
              )}
            </div>
          ))}

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
            className="bg-black text-white px-3 rounded-lg"
          >
            <Send size={16} />
          </button>
        </div>

      </div>
    </div>
  );
}