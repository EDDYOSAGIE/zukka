import { ReactNode, useState } from "react";
import { BarChart3, Boxes, Home, Route, ShieldCheck, Info, Mail, Menu, X, MessageSquareText, LogOut } from "lucide-react";
import { PageKey } from "../App";

type LayoutProps = {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  onLogout?: () => void;
  children: ReactNode;
};

const navItems: Array<{ key: PageKey; label: string; icon: typeof Home }> = [
  { key: "home", label: "Home", icon: Home },
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "inventory", label: "Inventory", icon: Boxes },
  { key: "logistics", label: "Logistics", icon: Route },
  { key: "about", label: "About Us", icon: Info },
  { key: "contact", label: "Contact", icon: Mail }
];

export function Layout({ activePage, onNavigate, onLogout, children }: LayoutProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="min-h-screen bg-mist text-slate-950">
      <button
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="fixed left-3 top-3 z-50 inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/95 p-2 text-navy shadow-calm lg:hidden"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-white/10 bg-navy text-white transition-[width] duration-300 lg:block ${open ? "w-72" : "w-20"}`}>
        <div className="flex h-full flex-col">
          <div className={`flex items-center gap-3 px-4 py-6 text-left ${open ? "justify-between pl-7" : "justify-center"}`}>
            <button onClick={() => onNavigate("home")} className="flex items-center gap-3 text-left">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-skybrand font-black text-navy">Z</span>
              {open ? (
                <span>
                  <span className="block text-xl font-black">Zukka</span>
                  <span className="text-sm text-sky-100">Social equity commerce</span>
                </span>
              ) : null}
            </button>
            {open ? (
              <button
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-sky-50 hover:bg-white/15"
                aria-label="Collapse sidebar"
              >
                <Menu size={18} />
              </button>
            ) : null}
          </div>
          {!open ? (
            <button
              onClick={() => setOpen(true)}
              className="mx-auto mb-4 grid h-9 w-9 place-items-center rounded-md bg-white/10 text-sky-50 hover:bg-white/15"
              aria-label="Expand sidebar"
            >
              <Menu size={18} />
            </button>
          ) : null}
          <nav className="space-y-2 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.key;
              return (
                <button
                  key={item.key}
                  title={open ? undefined : item.label}
                  onClick={() => onNavigate(item.key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold transition ${open ? "" : "justify-center"} ${
                    active ? "bg-skybrand text-navy" : "text-sky-50 hover:bg-white/10"
                  }`}
                >
                  <Icon size={18} />
                  {open ? <span>{item.label}</span> : null}
                </button>
              );
            })}
          </nav>
          <div className={`mt-auto border-t border-white/10 ${open ? "p-6 text-sm text-sky-100" : "p-3 text-center text-sky-100"}`}>
            <ShieldCheck className="mb-3 mx-auto" size={24} />
            {open ? "Built for Nigerian MSME chat conversion, Naira checkout, and pooled dispatch." : null}
            {onLogout ? (
              <button
                onClick={onLogout}
                className={`mt-4 inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 font-semibold text-white hover:bg-white/15 ${open ? "w-full justify-center" : "w-full justify-center"}`}
              >
                <LogOut size={16} />
                {open ? "Logout" : null}
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      <main className={`transition-[padding] duration-300 ${open ? "lg:pl-72" : "lg:pl-20"}`}>
        <div className="mx-auto min-h-screen w-full max-w-7xl px-5 py-5 sm:px-8 lg:px-10">{children}</div>
      </main>

      <button
        onClick={() => onNavigate("inbox")}
        aria-label="Open chat inbox"
        className="fixed right-4 bottom-20 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-skybrand text-navy shadow-xl"
      >
        <MessageSquareText size={20} />
      </button>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t bg-white/95 p-2 shadow-calm lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`grid justify-items-center rounded-md py-2 text-[11px] font-bold ${
                activePage === item.key ? "bg-navy text-white" : "text-slatecopy"
              }`}
            >
              <Icon size={17} />
              {item.label.split(" ")[0]}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHeader({ eyebrow, title, copy }: { eyebrow?: string; title: string; copy: string }) {
  return (
    <header className="mb-7">
      {eyebrow ? <p className="mb-2 text-xs font-black uppercase tracking-[0.24em] text-emerald">{eyebrow}</p> : null}
      <h1 className="max-w-4xl text-4xl font-black tracking-normal text-navy md:text-5xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-base leading-7 text-slatecopy">{copy}</p>
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-slate-200 bg-white p-5 shadow-calm ${className}`}>{children}</section>;
}
