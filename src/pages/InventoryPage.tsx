import { Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { Card, PageHeader } from "../components/Layout";
import { formatNaira, useZukka } from "../state/ZukkaContext";

export function InventoryPage() {
  const { inventory, addInventoryItem } = useZukka();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [basePrice, setBasePrice] = useState(12000);
  const [minFloor, setMinFloor] = useState(9000);
  const [stock, setStock] = useState(8);
  const [category,setCategory] = useState("New drop");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    addInventoryItem({
      title,
      basePrice,
      minFloor,
      stock,
      category: "New Drop",
      photo: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=600&q=80"
    });
    setTitle("");
    setOpen(false);
  };

  return (
    <div className="pb-24">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <PageHeader eyebrow="Warehouse terminal" title="Inventory registry " copy="Manage stock, retail base price, and minimum Naira bargain floors." />
        <button onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-md bg-navy px-5 py-3 font-black text-white">
          <Plus size={18} /> Add item
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {inventory.map((item) => (
          <Card key={item.id}>
            <img src={item.photo} alt={item.title} className="h-48 w-full rounded-md object-cover" />
            <h2 className="mt-4 text-lg font-black text-navy">{item.title}</h2>
            <p className="text-sm text-slatecopy">Stock {item.stock} · {item.category}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <div>
                <p className="text-xs font-black uppercase text-slatecopy">Base</p>
                <p className="font-black text-emerald">{formatNaira(item.basePrice)}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-slatecopy">Min floor</p>
                <p className="font-black text-navy">{formatNaira(item.minFloor)}</p>
              </div>
            </div>
            <button className="mt-5 inline-flex items-center gap-2 text-sm font-black text-red-600"><Trash2 size={16} /> Remove</button>
          </Card>
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/65 p-4">
          <form onSubmit={submit} className="w-full max-w-lg rounded-lg bg-white p-6 shadow-calm">
            <h2 className="text-2xl font-black text-navy">Add inventory item</h2>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-black text-navy">Title<input required className="mt-2 w-full rounded-md border p-3" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm font-black text-navy">Base price<input type="number" className="mt-2 w-full rounded-md border p-3" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} /></label>
                <label className="block text-sm font-black text-navy">Floor<input type="number" className="mt-2 w-full rounded-md border p-3" value={minFloor} onChange={(e) => setMinFloor(Number(e.target.value))} /></label>
                <label className="block text-sm font-black text-navy">Stock<input type="number" className="mt-2 w-full rounded-md border p-3" value={stock} onChange={(e) => setStock(Number(e.target.value))} /></label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-5 py-3 font-black text-navy">Cancel</button>
              <button className="rounded-md bg-navy px-5 py-3 font-black text-white">Save item</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
