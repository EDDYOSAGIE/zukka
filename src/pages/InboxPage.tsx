import { AlertTriangle, Check, MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { PageKey } from "../App";
import { Card, PageHeader } from "../components/Layout";
import { formatNaira, useZukka } from "../state/ZukkaContext";

export function InboxPage({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const { chats, inventory, approveBargain, declineBargain, sendReply } = useZukka();
  const [alertId, setAlertId] = useState(chats[0]?.id);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [editPrice, setEditPrice] = useState(0);
  const [editMessage, setEditMessage] = useState("");
  const alert = chats.find((chat) => chat.id === alertId) ?? chats[0];
  const alertItem = inventory.find((item) => item.id === alert?.itemId)
    ?? inventory.find((item) => alert?.text?.toLowerCase().includes(item.title.toLowerCase()))
    ?? inventory[0];

  const approve = () => {
    if (!alert) return;
    void approveBargain(alert.id).then(() => onNavigate("checkout"));
  };

  const decline = () => {
    if (!alert) return;
    void declineBargain(alert.id);
  };

  const openEditPanel = () => {
    if (!alert) return;
    setEditPrice(alert.suggestedPrice ?? alertItem?.basePrice ?? 0);
    setEditMessage("");
    setIsEditPanelOpen(true);
  };

  const saveCounteroffer = () => {
    if (!alert) return;
    const note = editMessage.trim() || `Counteroffer updated to ${formatNaira(editPrice)}`;
    void sendReply(alert.id, note, editPrice);
    setIsEditPanelOpen(false);
    setEditMessage("");
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-black via-navy to-mist pb-24">
      {/* Decorative shapes — behind content */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-16 top-24 h-72 w-72 bg-gradient-to-b from-skybrand/40 to-skybrand/5 blur-[2px]"
          style={{
            clipPath: "polygon(0% 0%, 70% 0%, 100% 30%, 100% 100%, 30% 100%, 0% 70%)"
          }}
        />
        <div
          className="absolute right-10 top-10 h-40 w-96 bg-gradient-to-br from-slate-400/30 to-navy/40 blur-[1px]"
          style={{
            clipPath: "polygon(0% 0%, 70% 0%, 100% 40%, 100% 100%, 30% 100%, 0% 60%)"
          }}
        />
      </div>

      <div className="relative z-10 px-6 pt-10">
        <PageHeader
          eyebrow="Assisted Selling"
          title="Zukka Inbox"
          copy="Real-time business conversation platform"
        />

        {alert ? (
          <div className="group relative mb-6 overflow-hidden rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-white p-5 shadow-sm transition-shadow hover:shadow-md">
            {/* Accent bar */}
            <div className="absolute inset-y-0 left-0 w-1 bg-amber-400" />

            <div className="flex flex-col gap-4 pl-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <AlertTriangle size={18} strokeWidth={2.25} />
                </span>

                <div className="space-y-1.5">
                  <h2 className="text-[15px] font-bold tracking-tight text-navy">
                    Bargain request detected
                  </h2>
                  <p className="text-sm leading-relaxed text-slatecopy">
                    {alertItem ? `${alertItem.title} · ` : ""}
                    Customer asked for a discount. Safe margin allows{" "}
                    <span className="font-semibold text-navy">10% off</span>.
                  </p>

                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="text-xs text-slate-400 line-through">
                      {formatNaira(alertItem?.basePrice ?? 0)}
                    </span>
                    <span className="font-mono text-base font-bold text-navy">
                      {formatNaira(alert.suggestedPrice ?? 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-none flex-wrap gap-2 pl-12 sm:pl-0">
                <button
                  onClick={approve}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-navy/90 active:scale-[0.98]"
                >
                  <Check size={14} strokeWidth={2.5} /> Approve
                </button>
                <button
                  type="button"
                  onClick={openEditPanel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold uppercase tracking-wide text-navy transition-colors hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98]"
                >
                  Counter
                </button>
                <button
                  type="button"
                  onClick={decline}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 py-2.5 text-xs font-bold uppercase tracking-wide text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-50 active:scale-[0.98]"
                >
                  <X size={14} strokeWidth={2.5} /> Decline
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-black text-navy">
                <MessageCircle size={20} /> Zukka Inbox
              </h2>
              <span className="rounded-full bg-skybrand/20 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-navy">
                Live Meta inbox
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {["instagram", "whatsapp"].map((channel) => (
                <section key={channel} className="rounded-lg bg-mist p-4">
                  <h3 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-navy">{channel}</h3>
                  <div className="space-y-3">
                    {chats.filter((chat) => chat.channel === channel).map((chat) => {
                      const isSelected = alertId === chat.id;
                      return (
                        <button
                          key={chat.id}
                          onClick={() => setAlertId(chat.id)}
                          className={`w-full rounded-md border p-4 text-left shadow-sm ${
                            isSelected ? "border-skybrand bg-skybrand/10" : "border-transparent bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-black text-navy">{chat.handle}</p>
                            {chat.status === "approved" ? (
                              <span className="text-xs font-black text-emerald">Approved</span>
                            ) : null}
                            {chat.status === "countered" ? (
                              <span className="text-xs font-black text-amber-600">Edited</span>
                            ) : null}
                            {chat.status === "declined" ? (
                              <span className="text-xs font-black text-rose-500">Declined</span>
                            ) : null}
                          </div>
                          {chat.media ? (
                            <img
                              src={chat.media}
                              alt="Chat attachment"
                              className="mt-3 h-32 w-full rounded-md object-cover"
                            />
                          ) : null}
                          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{chat.text}</p>
                          {chat.approved ? (
                            <p className="mt-3 text-xs font-black text-emerald">Checkout link dispatched</p>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="mb-4 text-xl font-black text-navy">Live commerce message queue</h2>
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slatecopy">
              Meta inbound messages appear here automatically once a customer sends a bargain request from Instagram
              or WhatsApp.
            </div>
            {alertItem ? (
              <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <img src={alertItem.photo} alt={alertItem.title} className="h-40 w-full object-cover" />
                <div className="p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-skybrand">Negotiation target</p>
                  <h3 className="mt-2 text-lg font-black text-navy">{alertItem.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slatecopy">
                    selected product
                  </p>
                  <div className="mt-4 space-y-2 text-sm text-slatecopy">
                    <div className="flex items-center justify-between gap-3">
                      <span>Requested price</span>
                      <span className="font-black text-navy">
                        {formatNaira(alert?.suggestedPrice ?? alertItem.basePrice)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Base price</span>
                      <span>{formatNaira(alertItem.basePrice)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Floor price</span>
                      <span>{formatNaira(alertItem.minFloor)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slatecopy">
                Select an inbound message to see the product being negotiated.
              </div>
            )}
            <p className="text-sm leading-6 text-slatecopy">
              We check every offer against your minimum price. Only approved offers get a payment link sent in the chat. You never sell for less than you want.
            </p>
          </Card>
        </div>
      </div>

      {isEditPanelOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-navy">Edit counteroffer</h3>
                <p className="mt-1 text-sm leading-6 text-slatecopy">
                  Adjust the price or leave a reply for the customer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditPanelOpen(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-black text-navy">Suggested price</span>
              <input
                type="number"
                value={editPrice}
                onChange={(event) => setEditPrice(Number(event.target.value) || 0)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-navy outline-none"
              />
            </label>

            <label className="mb-6 block">
              <span className="mb-2 block text-sm font-black text-navy">Reply</span>
              <textarea
                value={editMessage}
                onChange={(event) => setEditMessage(event.target.value)}
                rows={4}
                placeholder="Write a friendly custom message..."
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-navy outline-none"
              />
            </label>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditPanelOpen(false)}
                className="rounded-md border border-slate-200 px-4 py-3 text-sm font-black text-navy"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCounteroffer}
                className="rounded-md bg-navy px-4 py-3 text-sm font-black text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}