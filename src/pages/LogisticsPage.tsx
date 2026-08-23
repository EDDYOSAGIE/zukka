import { Clock, MapPin, PackageCheck, Route, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card, PageHeader } from "../components/Layout";
import { getDeliveryByOrder } from "../lib/api";
import { formatNaira, useZukka } from "../state/ZukkaContext";

export function LogisticsPage() {
  const { orders, inventory } = useZukka();
  const [deliveryStatusByOrder, setDeliveryStatusByOrder] = useState<Record<string, { provider?: string; status?: string }>>({});

  const poolGroups = useMemo(() => {
    /* FOUNDER_INNOVATION_SPACE_MODULE_3_LOGISTICS_POOLING_CRON */
    return orders
      .filter((order) => order.deliveryMethod === "eco_pool")
      .reduce<Record<string, typeof orders>>((groups, order) => {
        const key = `${order.lga} Hub Cluster`;
        groups[key] = groups[key] ? [...groups[key], order] : [order];
        return groups;
      }, {});
  }, [orders]);

  const itemName = (id: string) => inventory.find((item) => item.id === id)?.title ?? "Inventory item";

  const expressOrders = orders.filter((order) => order.deliveryMethod === "express");
  const featuredOrder = expressOrders[0] ?? orders[0];
  const featuredStatus = featuredOrder ? deliveryStatusByOrder[featuredOrder.id]?.status ?? featuredOrder.status : null;

  useEffect(() => {
    let mounted = true;

    Promise.all(
      orders.map(async (order) => {
        try {
          const response = await getDeliveryByOrder(order.id);
          const delivery = response?.data ?? null;
          if (!mounted || !delivery) return;

          setDeliveryStatusByOrder((current) => ({
            ...current,
            [order.id]: {
              provider: delivery.provider ?? "chowdeck",
              status: delivery.status ?? "pending"
            }
          }));
        } catch (error) {
          console.warn("[frontend.logistics] Failed to fetch delivery state for order", order.id, error);
        }
      })
    ).catch((error) => {
      console.warn("[frontend.logistics] Delivery sync failed.", error);
    });

    return () => {
      mounted = false;
    };
  }, [orders]);

  return (
    <div className="pb-24">
      {/* Live route hero — top half background */}
      <div
        className="relative -mx-5 -mt-5 overflow-hidden bg-navy px-5 pb-16 pt-8 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(124,199,232,0.18) 1px, transparent 1px)",
          backgroundSize: "22px 22px"
        }}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <span className="select-none text-[9rem] font-black leading-none text-white/[0.04] sm:text-[13rem]">
            ROUTE
          </span>
        </div>

        <div className="relative z-10">
          <PageHeader
            eyebrow="Fulfillment terminal"
            title="Delivery & logistics"
            copy="Track express riders and Chowdeck-pooled routes from one place."
          />
        </div>

        {featuredOrder ? (
          <div className="relative z-10 mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full max-w-sm rounded-xl bg-white p-4 text-navy shadow-calm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black">{featuredOrder.customer}</p>
                  <p className="text-xs text-slatecopy">{itemName(featuredOrder.itemId)}</p>
                </div>
                <span className="rounded-full bg-emerald px-3 py-1 text-xs font-black text-white">
                  {featuredStatus}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slatecopy">
                <MapPin size={14} className="text-skybrand" /> {featuredOrder.lga}
                <span className="mx-1">·</span>
                {featuredOrder.ref}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slatecopy">Method</p>
                  <p className="font-black text-navy">{featuredOrder.deliveryMethod === "express" ? "Express" : "Pooled"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slatecopy">Price</p>
                  <p className="font-black text-navy">{formatNaira(featuredOrder.price)}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-navy shadow-calm">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-emerald/10 text-emerald">
                <Truck size={18} />
              </span>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slatecopy">Powered by</p>
                <p className="font-black text-navy">Chowdeck</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="relative z-10 mt-6 text-sm text-sky-50">No active deliveries yet — new orders will appear here.</p>
        )}
      </div>

      {/* Delivery lists */}
      <div className="mt-6 space-y-6">
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-navy"><Route size={20} /> Express Dispatch</h2>
          <div className="space-y-3">
            {expressOrders.length === 0 ? (
              <p className="text-sm text-slatecopy">No express deliveries in progress.</p>
            ) : null}
            {expressOrders.map((order) => (
              <div key={order.id} className="flex flex-col justify-between gap-2 rounded-md bg-mist p-4 sm:flex-row sm:items-center">
                <div>
                  <p className="font-black text-navy">{itemName(order.itemId)}</p>
                  <p className="text-sm text-slatecopy">{order.ref} · {order.customer} · {order.lga}</p>
                </div>
                <span className="rounded-full bg-emerald px-3 py-1 text-xs font-black text-white">
                  {deliveryStatusByOrder[order.id]?.status ?? order.status}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 flex items-center gap-2 text-xl font-black text-navy"><PackageCheck size={20} /> Pooled Delivery</h2>
          <p className="mb-4 text-sm text-slatecopy">Orders grouped by LGA and routed together to cut delivery cost.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.keys(poolGroups).length === 0 ? (
              <p className="text-sm text-slatecopy">No pooled orders yet.</p>
            ) : null}
            {Object.entries(poolGroups).map(([hub, hubOrders]) => (
              <div key={hub} className="rounded-md border border-skybrand/30 bg-skybrand/10 p-4">
                <h3 className="font-black text-navy">{hub}</h3>
                <p className="mb-4 text-sm text-slatecopy">{hubOrders.length} orders · {formatNaira(hubOrders.reduce((sum, order) => sum + order.price, 0))}</p>
                <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slatecopy">
                  <Truck size={14} className="text-emerald" /> Chowdeck provider 
                </div>
                <div className="space-y-2">
                  {hubOrders.map((order) => (
                    <div key={order.id} className="flex justify-between rounded-md bg-white p-3 text-sm">
                      <span>{itemName(order.itemId)} · {order.customer}</span>
                      <strong>{formatNaira(order.price)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}