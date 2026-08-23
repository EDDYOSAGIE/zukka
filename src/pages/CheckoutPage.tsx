import { BadgeCheck, Banknote, CreditCard, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card, PageHeader } from "../components/Layout";
import { listAvailableRiders } from "../lib/api";
import { DeliveryMethod, formatNaira, useZukka } from "../state/ZukkaContext";

type AvailableRider = {
  id: string;
  full_name: string;
  phone: string;
  service_lga: string;
  vehicle_type: "bike" | "car" | "van";
  is_available: boolean;
};

export function CheckoutPage() {
  const { orders, inventory, selectedCheckoutRef, markOrderPaid, setDeliveryMethod } = useZukka();
  const order = orders.find((entry) => entry.ref === selectedCheckoutRef) ?? orders[0];
  const item = inventory.find((entry) => entry.id === order.itemId) ?? inventory[0];
  const [pathway, setPathway] = useState<"bank" | "bnpl">("bank");
  const [verified, setVerified] = useState(false);
  const [availableRiders, setAvailableRiders] = useState<AvailableRider[]>([]);
  const accountNumber = useMemo(() => String(Math.floor(1000000000 + Math.random() * 8999999999)), [order.ref]);
  const shipping = order.deliveryMethod === "express" ? 3500 : 1200;

  const chooseDelivery = (method: DeliveryMethod) => setDeliveryMethod(order.ref, method);

  useEffect(() => {
    let cancelled = false;

    listAvailableRiders(order.lga)
      .then((riders) => {
        if (!cancelled) {
          setAvailableRiders(riders);
        }
      })
      .catch((error) => {
        console.warn("[frontend.riders] Unable to load available riders.", error);
        if (!cancelled) {
          setAvailableRiders([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [order.lga]);

  return (
    <div className="pb-24">
      <PageHeader
        eyebrow="Customer gateway"
        title="Lightweight secure checkout"
        copy="A compressed Naira checkout flow for bank transfer, BNPL risk routing, and customer-selected logistics."
      />
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <img src={item.photo} alt={item.title} className="h-64 w-full rounded-md object-cover" />
          <h2 className="mt-5 text-2xl font-black text-navy">{item.title}</h2>
          <p className="text-sm text-slatecopy">Order {order.ref} · {order.customer}</p>
          <div className="mt-5 rounded-md bg-mist p-4">
            <div className="flex justify-between font-bold"><span>Markdown price</span><span>{formatNaira(order.price)}</span></div>
            <div className="mt-2 flex justify-between font-bold"><span>Logistics</span><span>{formatNaira(shipping)}</span></div>
            <div className="mt-3 flex justify-between border-t pt-3 text-xl font-black text-navy"><span>Total</span><span>{formatNaira(order.price + shipping)}</span></div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <button onClick={() => setPathway("bank")} className={`rounded-md border p-4 text-left font-black ${pathway === "bank" ? "border-skybrand bg-skybrand/20 text-navy" : "text-slatecopy"}`}>
                <Banknote className="mb-2" /> Instant Dynamic Bank Transfer
              </button>
              <button onClick={() => setPathway("bnpl")} className={`rounded-md border p-4 text-left font-black ${pathway === "bnpl" ? "border-skybrand bg-skybrand/20 text-navy" : "text-slatecopy"}`}>
                <CreditCard className="mb-2" /> Pay in 4 Installments via BNPL
              </button>
            </div>
            {pathway === "bank" ? (
              <div className="rounded-md bg-mist p-4">
                <p className="text-xs font-black uppercase text-slatecopy">Virtual account</p>
                <p className="mt-2 text-3xl font-black text-navy">{accountNumber}</p>
                <p className="mt-1 text-sm text-slatecopy">Wema Bank · Zukka Settlement / {order.ref}</p>
                <button
                  onClick={() => {
                    if (order.checkoutUrl) {
                      window.location.href = order.checkoutUrl;
                      return;
                    }
                    markOrderPaid(order.ref);
                  }}
                  className="mt-5 inline-flex items-center gap-2 rounded-md bg-emerald px-4 py-3 font-black text-white"
                >
                  <BadgeCheck size={18} /> Continue to Paystack Checkout
                </button>
              </div>
            ) : (
              <div className="space-y-3 rounded-md bg-mist p-4">
                {/* FOUNDER_INNOVATION_SPACE_MODULE_2_PAYSTACK_AND_CREDITCHEK */}
                <input className="w-full rounded-md border p-3" placeholder="BVN" />
                <input className="w-full rounded-md border p-3" placeholder="Phone number" />
                <label className="flex gap-2 text-sm text-slatecopy"><input type="checkbox" /> I consent to legal data sharing for credit validation.</label>
                <button onClick={() => setVerified(true)} className="rounded-md bg-navy px-4 py-3 font-black text-white">Verify Profile Credit via CreditChek API</button>
                {verified ? <p className="font-black text-emerald">Profile approved. Merchant receives upfront settlement.</p> : null}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-navy"><Truck size={20} /> Logistics Allocation</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <DeliveryCard active={order.deliveryMethod === "express"} title="Express Dispatch Rider" price={3500} copy="Immediate single rider from merchant pickup point." onClick={() => chooseDelivery("express")} />
              <DeliveryCard active={order.deliveryMethod === "eco_pool"} title="Eco-Savings Pool Logistics" price={1200} copy="Grouped by LGA hub and released at daily route cutoff." onClick={() => chooseDelivery("eco_pool")} />
            </div>
            <div className="mt-4 rounded-md bg-mist p-4">
              <p className="text-xs font-black uppercase text-slatecopy">Available riders in {order.lga}</p>
              <div className="mt-3 space-y-2">
                {availableRiders.length > 0 ? (
                  availableRiders.map((rider) => (
                    <div key={rider.id} className="flex items-center justify-between rounded-md bg-white p-3 text-sm">
                      <span className="font-black text-navy">{rider.full_name}</span>
                      <span className="text-slatecopy">{rider.vehicle_type} - {rider.phone}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slatecopy">No live rider match yet. Order can still enter the LGA pool.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DeliveryCard({ active, title, price, copy, onClick }: { active: boolean; title: string; price: number; copy: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-md border p-4 text-left ${active ? "border-skybrand bg-skybrand/20" : "border-slate-200"}`}>
      <p className="font-black text-navy">{title}</p>
      <p className="mt-1 font-black text-emerald">{formatNaira(price)}</p>
      <p className="mt-2 text-sm leading-6 text-slatecopy">{copy}</p>
    </button>
  );
}
