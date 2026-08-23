import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Heart, Loader2, MessageCircle, RadioTower, ShoppingBag, Store, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { PageKey } from "../App";
import { Card } from "../components/Layout";
import { isSessionActive } from "../lib/api";
import { useZukka } from "../state/ZukkaContext";

export function HomePage({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const { channels, connectMeta } = useZukka();
  const [activeSignal, setActiveSignal] = useState("Merchant profile");
  const [showSignalPanel, setShowSignalPanel] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [connectMessage, setConnectMessage] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<string | null>("what-is-zukka");

  useEffect(() => {
    let mounted = true;
    isSessionActive()
      .then((active) => {
        if (mounted) {
          setSessionActive(active);
        }
      })
      .finally(() => {
        if (mounted) {
          setSessionLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const faqItems = [
    {
      id: "what-is-zukka",
      question: "What is Zukka?",
      answer: "Zukka is a social commerce operating system for merchants who want to turn Instagram and WhatsApp conversations into checkout-ready sales, approvals, and pooled delivery workflows."
    },
    {
      id: "do-i-need-meta",
      question: "Do I need Meta Business tools to use Zukka?",
      answer: "You only need to connect your Instagram and WhatsApp Business accounts if you want to automate DM handling and social customer conversations through the platform."
    },
    {
      id: "is-login-required",
      question: "Is login required to use the platform?",
      answer: "Yes. Merchant-only features such as dashboard access, channel onboarding, and checkout approval are protected behind authentication to keep your business data secure."
    },
    {
      id: "how-does-checkout-work",
      question: "How does the checkout flow work?",
      answer: "Once a customer request is approved, Zukka creates a secure checkout link, routes payment, and keeps the order ready for delivery coordination."
    }
  ];

  return (
    <div className="pb-24">
      <section
        className="navy-hero relative -mx-5 -mt-5 min-h-[680px] overflow-hidden px-5 py-5 text-white sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(7,26,45,0.92) 0%, rgba(10,37,64,0.88) 55%, rgba(10,37,64,0.95) 100%), url('/home/Untitled design (23).png')",
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        <div className="relative z-10 flex items-center justify-between border-b border-white/15 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-md /95 px-3 py-1.5 shadow-calm">
              <img src="/logo/Gold Modern Real Estate Company Logo.png" alt="Zukka" className="h-12 w-auto" />
            </div>
          </div>
          <div className="hidden items-center gap-6 text-sm font-bold text-sky-50 md:flex">
            <button onClick={() => onNavigate("dashboard")}>Dashboard</button>
            <button onClick={() => onNavigate("about")}>About</button>
            <button onClick={() => onNavigate("contact")}>Contact</button>
            <button onClick={() => onNavigate("auth")}>Login</button>
          </div>
          <button onClick={() => onNavigate("auth")} className="rounded-md bg-white px-4 py-2 text-sm font-black text-navy shadow-calm">
            Login / Sign up
          </button>
        </div>

        <div className="relative z-10 grid min-h-[560px] content-center gap-10 py-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-skybrand">Social commerce at its finest</p>
            <h1 className="text-5xl font-black leading-[1.02] tracking-normal md:text-7xl">Turn every DM into a paid Zukka checkout.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-sky-50">
              Your entire shop, in one chat-powered dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => onNavigate("about")} className="focus-ring inline-flex items-center gap-2 rounded-md bg-skybrand px-5 py-3 font-black text-navy shadow-calm">
                Learn more <ArrowRight size={18} />
              </button>
              <button onClick={() => onNavigate("dashboard")} className="focus-ring rounded-md border border-white/25 px-5 py-3 font-black text-white">
                View merchant HQ
              </button>
            </div>
             </div>

          <div className="relative min-h-[560px]">
            <FloatingSocialCard
              className="left-2 top-6 w-[72%] max-w-[390px] rotate-[-5deg]"
              image="/home/social-reactions.png"
              title="Live attention"
              copy="A customer reacts to a fresh product drop."
              metric="68 signals"
              onHover={() => setActiveSignal("Instagram drop spike")}
            />
            <FloatingSocialCard
              className="right-0 top-24 w-[62%] max-w-[330px] rotate-[4deg] delay-float"
              image="/home/social-shopping.png"
              title="Social browsing"
              copy="Chats turn into item questions and price intent."
              metric="12 DMs"
              onHover={() => setActiveSignal("DM -> Sales flow")}
            />
            <FloatingSocialCard
              className="bottom-8 left-16 w-[66%] max-w-[350px] rotate-[2deg] slow-float"
              image="/home/merchant-checkout.png"
              title="Merchant checkout"
              copy="Payment confirmation moves into dispatch."
              metric="Paid"
              onHover={() => setActiveSignal("Merchant profile")}
            />

              <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full bg-white px-4 py-3 font-black text-navy shadow-calm">
              <Heart className="fill-emerald text-emerald" size={18} /> +45% reach
            </div>

            <div className="absolute bottom-2 right-2 z-20 text-navy">
              <div className={`rounded-lg bg-skybrand p-4 text-navy shadow-calm transition-transform ${showSignalPanel ? "translate-y-0" : "translate-y-6"}`}>
                <div className="flex items-start justify-between">
                      <button
                    onClick={() => setShowSignalPanel((value) => !value)}
                    className="ml-3 rounded-full bg-white/90 p-1 text-navy"
                    aria-label={showSignalPanel ? "Collapse signals" : "Expand signals"}
                  >
                    {showSignalPanel ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </button>
                </div>
              </div>
              {!showSignalPanel ? (
                <button onClick={() => setShowSignalPanel(true)} className="mt-2 rounded-full bg-skybrand/90 p-2 text-white shadow-calm" aria-label="Open signals">
                  <ChevronUp size={16} />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="pt-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald">Connect channels</p>
            <h2 className="mt-2 text-3xl font-black text-navy">Merchant onboarding matrix</h2>
          </div>   
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {!sessionLoading && !sessionActive ? (
            <Card className="border-skybrand/50">
              <div className="mb-5 flex items-center justify-between">
                <RadioTower className="text-navy" />
                <span className="rounded-full bg-skybrand/20 px-3 py-1 text-xs font-black text-navy">Protected</span>
              </div>
              <h3 className="text-xl font-black text-navy">Meta Business Integration Hub</h3>
              <p className="mt-2 text-sm leading-6 text-slatecopy">Instagram and WhatsApp onboarding is protected behind merchant authentication.</p>
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slatecopy">
                <p className="font-black uppercase tracking-[0.24em] text-navy">Why login first?</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Only signed-in merchants can begin Meta onboarding.</li>
                  <li>This prevents unauthorized access to Instagram and WhatsApp business setup.</li>
                  <li>Session-based access is more secure than exposing connect links publicly.</li>
                </ul>
              </div>
            </Card>
          ) : (
            <Card className="border-skybrand/50">
              <div className="mb-5 flex items-center justify-between">
                <RadioTower className="text-navy" />
                <StatusBadge status={channels.meta} />
              </div>
              <h3 className="text-xl font-black text-navy">Meta Business Integration Hub</h3>
              <p className="mt-2 text-sm leading-6 text-slatecopy">Map Instagram DMs and WhatsApp chats into one workspace.</p>
              <button
                disabled={channels.meta === "processing" || channels.meta === "connected" || !termsAccepted}
                onClick={async () => {
                  setConnectMessage(null);
                  try {
                    await connectMeta();
                    setConnectMessage("A new tab opened so you can finish Meta onboarding. Please complete the Instagram and WhatsApp connection there.");
                  } catch (error) {
                    const message = error instanceof Error ? error.message : "Unable to start Meta onboarding.";
                    setConnectMessage(message.includes("authorization") ? "Please login first to connect your socials." : message);
                    if (message.includes("authorization")) {
                      onNavigate("auth");
                    }
                  }
                }}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-navy px-4 py-3 font-black text-white disabled:bg-emerald"
              >
                {channels.meta === "processing" ? <Loader2 className="animate-spin" size={18} /> : null}
                {channels.meta === "connected" ? "Connected" : "Connect Social Profiles"}
              </button>
              {connectMessage ? <p className="mt-3 text-sm font-black text-slatecopy">{connectMessage}</p> : null}
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slatecopy">
                <label className="inline-flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-navy focus:ring-navy"
                  />
                  <span>
                    I agree to Zukka&apos;s social onboarding terms and conditions
                  </span>
                </label>
                
              </div>
            </Card>
          )}
          <ChannelCard title="TikTok Platform" copy="Optional Tiktok integration(coming soon)." />
          <ChannelCard title="Snapchat Platform" copy="Optional  Snapchat integration(coming soon)."></ChannelCard>
          </div>
      </section>

      <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-calm">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald">FAQ</p>
            <h2 className="mt-2 text-3xl font-black text-navy">Common questions</h2>
          </div>
          <p className="text-sm text-slatecopy">Quick answers for new merchants</p>
        </div>
        <div className="space-y-3">
          {faqItems.map((item) => {
            const isOpen = openFaq === item.id;
            return (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : item.id)}
                  className="flex w-full items-center justify-between px-4 py-4 text-left"
                >
                  <span className="text-sm font-black text-navy">{item.question}</span>
                  <span className="text-xl font-black text-slatecopy">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen ? <p className="px-4 pb-4 text-sm leading-7 text-slatecopy">{item.answer}</p> : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function FloatingSocialCard({
  image,
  title,
  copy,
  metric,
  className,
  onHover
}: {
  image: string;
  title: string;
  copy: string;
  metric: string;
  className: string;
  onHover: () => void;
}) {
  return (
    <button
      onMouseEnter={onHover}
      onFocus={onHover}
      className={`floating-social-card absolute z-10 overflow-hidden rounded-lg border border-white/20 bg-white p-2 text-left text-navy shadow-calm transition duration-300 hover:z-30 hover:rotate-0 hover:scale-[1.03] ${className}`}
    >
      <img src={image} alt={title} className="h-44 w-full rounded-md object-cover sm:h-52" />
      <div className="flex items-start justify-between gap-3 p-3">
        <div>
          <h3 className="font-black">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-slatecopy">{copy}</p>
        </div>
        <span className="shrink-0 rounded-full bg-skybrand/25 px-3 py-1 text-xs font-black text-navy">{metric}</span>
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald/10 px-3 py-1 text-xs font-black text-emerald">
        <CheckCircle2 size={14} /> Connected
      </span>
    );
  }
  return <span className="rounded-full bg-skybrand/20 px-3 py-1 text-xs font-black text-navy">{status === "processing" ? "Verifying" : "Link Channel"}</span>;
}

function ChannelCard({ title, copy }: { title: string; copy: string }) {
  return (
    <Card>
      <div className="mb-5 flex items-center justify-between">
        {title.includes("TikTok") ? <Store className="text-navy" /> : <Zap className="text-navy" />}
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slatecopy">Not Available</span>
      </div>
      <h3 className="text-xl font-black text-navy">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slatecopy">{copy}</p>
      <button className="mt-6 w-full rounded-md border border-slate-200 px-4 py-3 font-black text-navy">Link Channel</button>
    </Card>
  );
}