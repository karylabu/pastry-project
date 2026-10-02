import React, { useEffect, useMemo, useState } from "react";
import { Image, Menu, MessageCircle, RefreshCw, Search, Send, UserRound, X } from "lucide-react";
import { CUSTOMER_BASE, STAFF_BASE } from "../../services/config";
import { getAuthHeaders, safeParseJson } from "../../services/api";
import { subscribeRealtime } from "../../services/realtime";

const getImageUrl = (value) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${CUSTOMER_BASE}/${String(value).replace(/^\/+/, "")}`;
};

export default function AdminChatBubble() {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobilePanel, setMobilePanel] = useState("conversation");

  const selectedConversation = useMemo(
    () => conversations.find((item) => String(item.order_id) === String(selectedOrderId)),
    [conversations, selectedOrderId]
  );

  const visibleConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((item) => [item.customer_name, item.order_label, item.last_message]
      .some((value) => String(value || "").toLowerCase().includes(query)));
  }, [conversations, search]);

  const fetchConversations = async () => {
    try {
      const response = await fetch(`${STAFF_BASE}/api_chat_fetch_all.php`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await safeParseJson(response);
      if (!response.ok || data?.success === false) return;
      const next = Array.isArray(data.conversations) ? data.conversations : [];
      setConversations(next);
      if (selectedOrderId === null && next.length) setSelectedOrderId(next[0].order_id);
    } catch {
      // The inbox continues showing its last successful state.
    }
  };

  const fetchMessages = async (orderId = selectedOrderId) => {
    if (!orderId) return;
    try {
      const response = await fetch(`${STAFF_BASE}/api_chat_fetch.php?order_id=${encodeURIComponent(orderId)}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await safeParseJson(response);
      if (response.ok && data?.success !== false) setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch {
      // Polling errors are non-blocking.
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    fetchConversations();
    return subscribeRealtime((event) => {
      if (event.type === "chat.updated") fetchConversations();
    });
  }, [open]);

  useEffect(() => {
    if (!open || !selectedOrderId) return undefined;
    fetchMessages(selectedOrderId);
    return subscribeRealtime((event) => {
      if (event.type === "chat.updated" && Number(event.order_id || 0) === Number(selectedOrderId)) {
        fetchMessages(selectedOrderId);
      }
    });
  }, [open, selectedOrderId]);

  const sendReply = async (event) => {
    event.preventDefault();
    if (!selectedOrderId || (!draft.trim() && !attachment)) return;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append("order_id", String(selectedOrderId));
      formData.append("message", draft.trim());
      if (attachment) formData.append("image", attachment, attachment.name);

      const response = await fetch(`${STAFF_BASE}/api_chat_send.php`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await safeParseJson(response);
      if (!response.ok || data?.success !== true) throw new Error(data?.message || "Unable to send reply.");
      setDraft("");
      setAttachment(null);
      await Promise.all([fetchMessages(selectedOrderId), fetchConversations()]);
    } catch (error) {
      window.alert(error.message || "Unable to send reply.");
    } finally {
      setSending(false);
    }
  };

  const unreadCount = conversations.reduce((total, item) => total + Number(item.unread_count || 0), 0);
  const customerName = selectedConversation?.customer_name || "Customer";

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[10000] bg-[#f2f2f2] p-3 font-['DM_Sans'] sm:p-5 lg:p-8">
          <div className="mx-auto flex h-full max-w-[1600px] overflow-hidden rounded-[22px] border border-[#d1d1d1] bg-white shadow-[0_20px_70px_rgba(0,0,0,0.18)]">
            <aside className="hidden w-[72px] shrink-0 flex-col items-center gap-5 bg-black py-5 text-white md:flex">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-black"><MessageCircle size={21} /></div>
              <div className="mt-4 flex flex-col gap-4 text-white/60"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white"><Menu size={20} /></span><span className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/10"><UserRound size={20} /></span></div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#dce4e8] bg-white px-4 sm:px-7">
                <div className="flex items-center gap-3"><MessageCircle className="text-black" size={24} /><div><p className="text-lg font-bold text-black">Team Inbox</p><p className="hidden text-[10px] uppercase tracking-[0.18em] text-[#777] sm:block">Customer care</p></div></div>
                <div className="flex items-center gap-2"><button type="button" onClick={fetchConversations} className="rounded-lg p-2 text-[#555] hover:bg-[#f1f1f1]" title="Refresh"><RefreshCw size={18} /></button><button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-[#555] hover:bg-[#f1f1f1]" title="Close"><X size={20} /></button></div>
              </header>

              <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_280px]">
                <aside className={`${mobilePanel === "list" ? "flex" : "hidden"} min-h-0 flex-col border-r border-[#ddd] bg-white md:flex`}>
                  <div className="border-b border-[#ddd] p-4"><div className="flex items-center justify-between"><p className="font-semibold text-black">Conversations <span className="ml-1 rounded-full bg-[#e8e8e8] px-2 py-0.5 text-xs">{conversations.length}</span></p><button type="button" className="text-[#555]"><Menu size={17} /></button></div><div className="mt-4 flex items-center gap-2 rounded-lg border border-[#d5d5d5] px-3 py-2"><Search size={15} className="text-[#777]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="min-w-0 flex-1 text-xs text-black outline-none" /></div></div>
                  <div className="min-h-0 flex-1 overflow-y-auto">{visibleConversations.length === 0 ? <p className="p-5 text-sm text-[#777]">No conversations yet.</p> : visibleConversations.map((conversation) => { const active = String(conversation.order_id) === String(selectedOrderId); return <button key={`${conversation.order_id}-${conversation.last_message_at}`} type="button" onClick={() => { setSelectedOrderId(conversation.order_id); setMobilePanel("conversation"); }} className={`w-full border-b border-[#ededed] px-4 py-4 text-left ${active ? "border-l-4 border-l-black bg-[#f0f0f0]" : "hover:bg-[#f7f7f7]"}`}><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e5e5e5] text-sm font-bold text-black">{String(conversation.customer_name || "C").charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="truncate text-sm font-semibold text-black">{conversation.customer_name || "Customer"}</p>{Number(conversation.unread_count) > 0 && <span className="rounded-full bg-black px-2 py-0.5 text-[10px] text-white">{conversation.unread_count}</span>}</div><p className="mt-1 truncate text-[11px] text-[#666]">{conversation.last_message || "Image attachment"}</p><p className="mt-1 text-[10px] text-[#888]">{conversation.order_label || `Order #${conversation.order_id}`}</p></div></div></button>; })}</div>
                </aside>

                <section className={`${mobilePanel === "conversation" ? "flex" : "hidden"} min-h-0 flex-col bg-[#f5f5f5] md:flex`}>
                  <div className="flex items-center justify-between border-b border-[#ddd] bg-white px-4 py-4 sm:px-7"><div className="flex items-center gap-3"><button type="button" onClick={() => setMobilePanel("list")} className="rounded-lg p-1 text-[#555] md:hidden"><Menu size={18} /></button><div className="grid h-10 w-10 place-items-center rounded-full bg-[#e5e5e5] font-bold text-black">{customerName.charAt(0).toUpperCase()}</div><div><p className="font-semibold text-black">{customerName}</p><p className="text-xs text-[#777]">{selectedConversation?.order_label || "Select a conversation"}</p></div></div><span className="rounded-lg bg-[#ededed] px-3 py-2 text-xs text-[#555]">{selectedConversation?.order_status || "Customer"}</span></div>
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-8">{messages.length === 0 ? <div className="grid h-full place-items-center text-sm text-[#777]">Select a conversation to begin.</div> : messages.map((item) => <div key={item.id} className={`flex ${item.sender === "admin" ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${item.sender === "admin" ? "bg-white text-black" : "bg-[#e5e5e5] text-black"}`}>{getImageUrl(item.image_path) && <img src={getImageUrl(item.image_path)} alt="Chat attachment" className="mb-2 max-h-64 rounded-lg object-contain" />}{item.message && <p className="whitespace-pre-wrap text-sm leading-6">{item.message}</p>}<p className="mt-2 text-[10px] text-[#777]">{new Date(item.created_at).toLocaleString()}</p></div></div>)}</div>
                  <form onSubmit={sendReply} className="border-t border-[#ddd] bg-white p-4 sm:p-5"><div className="flex items-end gap-2 rounded-xl border border-[#d5d5d5] bg-white p-2 shadow-sm"><label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-[#555] hover:bg-[#f0f0f0]" title="Attach image"><Image size={18} /><input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] || null)} /></label><textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} placeholder="Reply to customer..." className="min-h-9 flex-1 resize-none px-2 py-2 text-sm text-black outline-none" /><button type="submit" disabled={!selectedOrderId || sending || (!draft.trim() && !attachment)} className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Send <Send size={15} /></button></div>{attachment && <p className="mt-2 text-xs text-[#777]">Attached: {attachment.name}</p>}</form>
                </section>

                <aside className="hidden border-l border-[#ddd] bg-white p-5 xl:block"><div className="rounded-xl border border-[#ddd] bg-white"><div className="flex items-center gap-2 border-b border-[#ddd] px-4 py-3 font-semibold text-black"><UserRound size={17} /> Contact info</div><div className="p-4"><div className="grid h-14 w-14 place-items-center rounded-full bg-[#e5e5e5] text-xl font-bold text-black">{customerName.charAt(0).toUpperCase()}</div><p className="mt-3 text-lg font-bold text-black">{customerName}</p><p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#777]">Order</p><p className="mt-1 text-sm text-black">{selectedConversation?.order_label || "—"}</p><p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#777]">Status</p><p className="mt-1 text-sm text-black">{selectedConversation?.order_status || "—"}</p></div></div></aside>
              </div>
            </div>
          </div>
        </div>
      )}

      <button type="button" onClick={() => setOpen((value) => !value)} className="fixed bottom-5 right-5 z-[10001] grid h-12 w-12 place-items-center rounded-full bg-black text-white shadow-xl transition hover:scale-105" title="Customer Chat" aria-label="Customer Chat"><MessageCircle size={21} />{unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-black">{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>
    </>
  );
}
