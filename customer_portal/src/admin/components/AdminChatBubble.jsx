import React, { useEffect, useMemo, useState } from "react";
import { Menu, MessageCircle, Paperclip, RefreshCw, Search, Send, UserRound, X } from "lucide-react";
import { CUSTOMER_BASE, LARAVEL_BASE } from "../../services/config";
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
  const [selectedConversationKey, setSelectedConversationKey] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobilePanel, setMobilePanel] = useState("conversation");

  const selectedConversation = useMemo(
    () => conversations.find((item) => String(item.conversation_key) === String(selectedConversationKey)),
    [conversations, selectedConversationKey]
  );

  const visibleConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((item) => [item.customer_name, item.order_label, item.last_message]
      .some((value) => String(value || "").toLowerCase().includes(query)));
  }, [conversations, search]);

  const fetchConversations = async () => {
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/staff/chat/conversations`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await safeParseJson(response);
      if (!response.ok || data?.success === false) return;
      const next = Array.isArray(data.conversations) ? data.conversations : [];
      setConversations(next);
      if (!next.some((item) => String(item.conversation_key) === String(selectedConversationKey))) {
        setSelectedConversationKey(next[0]?.conversation_key ?? null);
      }
    } catch {
      // The inbox continues showing its last successful state.
    }
  };

  const fetchMessages = async (conversation = selectedConversation) => {
    if (!conversation) return;
    try {
      const params = new URLSearchParams({
        order_id: String(conversation.order_id || 0),
        user_id: String(conversation.user_id || 0),
        conversation_id: conversation.conversation_id || "legacy",
      });
      const response = await fetch(`${LARAVEL_BASE}/api/staff/chat/messages?${params.toString()}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await safeParseJson(response);
      if (response.ok && data?.success !== false) {
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setConversations((current) => current.map((item) => (
          String(item.conversation_key) === String(conversation.conversation_key)
            ? { ...item, unread_count: 0 }
            : item
        )));
      }
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
    if (!open || !selectedConversation) return undefined;
    fetchMessages(selectedConversation);
    return subscribeRealtime((event) => {
      if (event.type === "chat.updated" && Number(event.order_id || 0) === Number(selectedConversation.order_id || 0)) {
        fetchMessages(selectedConversation);
      }
    });
  }, [open, selectedConversation]);

  const sendReply = async (event) => {
    event.preventDefault();
    if (!selectedConversation || (!draft.trim() && !attachment)) return;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append("order_id", String(selectedConversation.order_id || 0));
      formData.append("user_id", String(selectedConversation.user_id || 0));
      formData.append("conversation_id", selectedConversation.conversation_id || "legacy");
      formData.append("message", draft.trim());
      if (attachment) formData.append("image", attachment, attachment.name);

      const response = await fetch(`${LARAVEL_BASE}/api/staff/chat/messages`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await safeParseJson(response);
      if (!response.ok || data?.success !== true) throw new Error(data?.message || "Unable to send reply.");
      setDraft("");
      setAttachment(null);
      await Promise.all([fetchMessages(selectedConversation), fetchConversations()]);
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
        <div className="fixed inset-0 z-[10000] bg-[#fffaf0] p-3 font-['DM_Sans'] sm:p-5 lg:p-8">
          <div className="mx-auto flex h-full max-w-[1600px] overflow-hidden rounded-[22px] border border-[#e9d8ae] bg-white shadow-[0_20px_70px_rgba(0,0,0,0.18)]">
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#f0e6db] bg-[#fffdf8] px-4 text-black sm:px-7">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fff4cd] text-[#9b7810]"><MessageCircle size={20} /></span><div><p className="text-base font-bold sm:text-lg">Team Inbox</p><p className="text-[10px] text-gray-500">Customer care</p></div></div>
                <div className="flex items-center gap-1"><button type="button" onClick={fetchConversations} className="grid h-10 w-10 place-items-center rounded-full text-[#80600a] transition hover:bg-[#fff4cd] hover:text-black" title="Refresh" aria-label="Refresh conversations"><RefreshCw size={18} /></button><button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full text-[#80600a] transition hover:bg-[#fff4cd] hover:text-black" title="Close" aria-label="Close messages"><X size={20} /></button></div>
              </header>

              <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_280px]">
                <aside className={`${mobilePanel === "list" ? "flex" : "hidden"} min-h-0 flex-col border-r border-[#e5e5e5] bg-white md:flex`}>
                  <div className="border-b border-[#e5e5e5] p-4">
                    <div className="flex items-center justify-between"><p className="font-semibold text-black">Conversations <span className="ml-1 rounded-full bg-[#fff4cd] px-2 py-0.5 text-xs">{conversations.length}</span></p><button type="button" className="grid h-8 w-8 place-items-center rounded-full text-[#555] hover:bg-[#fffaf0]" title="Conversation options" aria-label="Conversation options"><Menu size={17} /></button></div>
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#e9d8ae] bg-white px-3 py-2.5 focus-within:border-[#d6a62d]"><Search size={15} className="shrink-0 text-[#9b7810]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="min-w-0 flex-1 bg-transparent text-xs text-black outline-none" /></div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {visibleConversations.length === 0 ? <p className="p-5 text-sm text-[#777]">No conversations yet.</p> : visibleConversations.map((conversation) => {
                      const active = String(conversation.conversation_key) === String(selectedConversationKey);
                      return (
                        <button key={conversation.conversation_key} type="button" onClick={() => { setSelectedConversationKey(conversation.conversation_key); setMobilePanel("conversation"); }} className={`w-full border-b border-[#ededed] px-4 py-4 text-left transition ${active ? "border-l-4 border-l-[#d6a62d] bg-[#fff4cd]" : "hover:bg-[#fffaf0]"}`}>
                          <div className="flex items-start gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f0b94d] text-sm font-bold text-black">{String(conversation.customer_name || "C").charAt(0).toUpperCase()}</div>
                            <div className="min-w-0 flex-1">
                              <div className="flex justify-between gap-2"><p className="truncate text-sm font-semibold text-black">{conversation.customer_name || "Customer"}</p>{Number(conversation.unread_count) > 0 && <span className="rounded-full bg-[#f0b94d] px-2 py-0.5 text-[10px] text-black">{conversation.unread_count}</span>}</div>
                              <p className="mt-1 truncate text-[11px] text-[#666]">{conversation.last_message || "Image attachment"}</p>
                              <p className="mt-1 text-[10px] text-[#888]">{conversation.order_label || `Order #${conversation.order_id}`}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </aside>

                <section className={`${mobilePanel === "conversation" ? "flex" : "hidden"} min-h-0 flex-col bg-[#fffaf3] md:flex`}>
                  <div className="flex items-center justify-between border-b border-[#f0e6db] bg-[#fffdf8] px-4 py-4 text-black sm:px-7">
                    <div className="flex items-center gap-3"><button type="button" onClick={() => setMobilePanel("list")} className="grid h-9 w-9 place-items-center rounded-full text-[#80600a] transition hover:bg-[#fff4cd] hover:text-black md:hidden" aria-label="Back to conversations"><Menu size={18} /></button><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fff4cd] font-bold text-[#80600a]">{customerName.charAt(0).toUpperCase()}</div><div><p className="font-semibold">{customerName}</p><p className="text-xs text-gray-500">{selectedConversation?.order_label || "Select a conversation"}</p></div></div>
                    <span className="rounded-full bg-[#fff4cd] px-3 py-1.5 text-[10px] font-semibold text-[#80600a]">{selectedConversation?.order_status || "Customer"}</span>
                  </div>
                  <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-[#fffaf3] px-3 py-4 sm:px-6 sm:py-5">
                    {messages.length === 0 ? <div className="grid h-full place-items-center text-center text-xs text-gray-400">Select a conversation to begin.</div> : messages.map((item, index) => {
                      const isAdmin = item.sender === "admin";
                      const messageDate = new Date(item.created_at).toDateString();
                      const previousDate = index > 0 ? new Date(messages[index - 1].created_at).toDateString() : null;
                      const showDateSeparator = index === 0 || messageDate !== previousDate;
                      const messageTime = new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                      return (
                        <React.Fragment key={item.id}>
                          {showDateSeparator && <div className="flex items-center gap-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400"><span className="h-px flex-1 bg-gray-200" /><span>{new Date(item.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span><span className="h-px flex-1 bg-gray-200" /></div>}
                          <div className={`flex gap-2 ${isAdmin ? "flex-row-reverse" : "flex-row"}`}>
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isAdmin ? "bg-[#fff4cd] text-[#80600a]" : "border border-[#d5d5d5] bg-white text-black"}`}>{isAdmin ? "A" : <UserRound size={12} />}</div>
                            <div className={`flex max-w-[78%] flex-col gap-1 ${isAdmin ? "items-end" : "items-start"}`}>
                              <span className="px-1 text-[11px] text-gray-400">{isAdmin ? "Admin" : customerName} · {messageTime}</span>
                              <div className={`rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${isAdmin ? "rounded-tr-sm bg-[#fff4cd] text-black" : "rounded-tl-sm border border-[#f0e6db] bg-white text-black"}`}>
                                {getImageUrl(item.image_path) && <img src={getImageUrl(item.image_path)} alt="Chat attachment" className="mb-1 max-h-48 max-w-full rounded-lg object-contain" />}
                                {item.message && <p className="whitespace-pre-wrap">{item.message}</p>}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                  <form onSubmit={sendReply} className="border-t border-[#e9d8ae] bg-white px-3 py-2.5 sm:px-5">
                    <div className="flex items-end gap-2">
                      <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border border-[#f0e6db] text-[#9b7810] transition hover:border-[#d4af37] hover:bg-[#fffaf0]" title="Attach image" aria-label="Attach image"><Paperclip size={15} /><input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] || null)} /></label>
                      <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={1} placeholder="Type your message..." className="max-h-20 min-h-10 flex-1 resize-none rounded-xl border border-[#f0e6db] bg-white px-3 py-2 text-sm text-black outline-none focus:border-[#d4af37]" />
                      <button type="submit" disabled={!selectedConversation || sending || (!draft.trim() && !attachment)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f0b94d] text-black transition hover:bg-[#e5ae3d] disabled:opacity-40" title="Send reply" aria-label="Send reply"><Send size={14} /></button>
                    </div>
                    {attachment && <p className="truncate px-12 pt-2 text-[11px] text-gray-500">{attachment.name}</p>}
                  </form>
                </section>

                <aside className="hidden border-l border-[#f0e6db] bg-white p-5 xl:block"><div className="overflow-hidden rounded-2xl border border-[#f0e6db] bg-white"><div className="flex items-center gap-2 border-b border-[#f0e6db] px-4 py-3 font-semibold text-black"><UserRound size={17} /> Contact info</div><div className="p-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#fff4cd] text-xl font-bold text-[#80600a]">{customerName.charAt(0).toUpperCase()}</div><p className="mt-3 text-lg font-bold text-black">{customerName}</p><p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Order</p><p className="mt-1 text-sm text-black">{selectedConversation?.order_label || "—"}</p><p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Status</p><p className="mt-1 text-sm text-black">{selectedConversation?.order_status || "—"}</p></div></div></aside>
              </div>
            </div>
          </div>
        </div>
      )}

      <button type="button" onClick={() => setOpen((value) => !value)} className="fixed bottom-5 right-5 z-[10001] grid h-12 w-12 place-items-center rounded-full bg-[#f0b94d] text-black shadow-xl transition hover:scale-105 hover:bg-[#e5ae3d]" title="Customer Chat" aria-label="Customer Chat"><MessageCircle size={21} />{unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-black px-1 text-[10px] font-bold text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>
    </>
  );
}
