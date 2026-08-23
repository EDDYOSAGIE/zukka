import { CheckCircle2, MessageCircle, ShieldCheck, Sparkles, TrendingUp, Truck, Users } from "lucide-react";
import { Card, PageHeader } from "../components/Layout";

export function AboutPage() {
  const steps = [
    {
      title: "Connect your channels",
      copy: "Merchants link Instagram and WhatsApp so every DM lands in one workspace.",
      icon: <MessageCircle size={20} />
    },
    {
      title: "Chat becomes checkout",
      copy: "Customers ask, negotiate, and confirm — Zuka calculates safe markdowns automatically.",
      icon: <Sparkles size={20} />
    },
    {
      title: "Reputation builds itself",
      copy: "Every completed order strengthens a merchant's trust score and public profile.",
      icon: <ShieldCheck size={20} />
    },
    {
      title: "Delivery, handled",
      copy: "Express or Chowdeck-pooled routing takes the order from paid to delivered.",
      icon: <Truck size={20} />
    }
  ];

  const pillars = [
    {
      title: "Chat-first sales",
      copy: "No storefront to build. Merchants sell directly inside the conversations they're already having.",
      icon: <MessageCircle size={18} />
    },
    {
      title: "Verified merchant profiles",
      copy: "A visible trust score and order history mean customers can gauge a merchant's reliability at a glance.",
      icon: <Users size={18} />
    },
    {
      title: "Naira-native payments",
      copy: "Pricing, checkout, and payouts are built around how Nigerian merchants and customers actually transact.",
      icon: <TrendingUp size={18} />
    },
    {
      title: "Reliable fulfillment",
      copy: "Express dispatch and pooled Chowdeck routing keep delivery honest, from confirmation to doorstep.",
      icon: <CheckCircle2 size={18} />
    }
  ];

  return (
    <div className="pb-24">
      {/* Hero */}
<div className="relative -mx-5 -mt-5 overflow-hidden bg-navy px-5 py-14 text-white sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
  <video
    autoPlay
    loop
    muted
    playsInline
    className="absolute inset-0 h-full w-full object-cover"
  >
    <source src="/videos/video.mp4" type="video/mp4" />
  </video>

  {/* Dark overlay so text stays readable over the footage */}
  <div className="absolute inset-0 bg-gradient-to-b from-navy/85 via-navy/75 to-navy/90" />

  <div className="relative z-10">
    <p className="text-xs font-black uppercase tracking-[0.24em] text-skybrand">About Zuka</p>
    <h1 className="mt-3 max-w-2xl text-4xl font-black leading-[1.05] md:text-5xl">
      Social-equity commerce for merchants 
    </h1>
    <p className="mt-5 max-w-xl text-lg leading-8 text-sky-50">
      We help small merchants turn Instagram and WhatsApp conversations into credible, paid, fulfilled orders 
      without building a storefront from scratch.
    </p>
    <div className="mt-7 flex flex-wrap gap-2">
      {["Chat-first", "Naira-native", "Trust-scored", "Chowdeck-delivered"].map((tag) => (
        <span key={tag} className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white">
          {tag}
        </span>
      ))}
    </div>
  </div>
</div>

      {/* Mission + credibility */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="text-xl font-black text-navy">Our mission</h3>
          <p className="mt-3 text-sm leading-6 text-slatecopy">
            We believe local merchants can grow responsibly by combining chat-first sales, transparent reputation,
            and reliable logistics — no separate app, no storefront to maintain.
          </p>
        </Card>
        <Card>
          <h3 className="text-xl font-black text-navy">Merchant credibility</h3>
          <p className="mt-3 text-sm leading-6 text-slatecopy">
            Merchants build verified profiles, publish product catalogs, and demonstrate fulfillment reliability —
            all contributing to the social equity metrics used across the platform.
          </p>
        </Card>
      </div>

      {/* How it works */}
      <div className="mt-12">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald">How it works</p>
        <h2 className="mt-2 text-3xl font-black text-navy">From first DM to delivered order</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.title} className="relative">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-skybrand/20 text-navy">
                  {step.icon}
                </span>
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slatecopy">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="mt-4 font-black text-navy">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slatecopy">{step.copy}</p>
              {index < steps.length - 1 ? (
                <div className="mt-6 hidden h-px w-full bg-slate-200 md:block" />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Why choose us */}
      <div className="mt-12">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald">Why merchants choose Zuka</p>
        <h2 className="mt-2 text-3xl font-black text-navy">Built around how you actually sell</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {pillars.map((pillar) => (
            <Card key={pillar.title}>
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-md bg-skybrand/20 text-navy">
                  {pillar.icon}
                </span>
                <div>
                  <h3 className="font-black text-navy">{pillar.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slatecopy">{pillar.copy}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Trust strip */}
      <Card className="mt-12">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald">Built for trust</p>
            <h2 className="mt-2 text-2xl font-black text-navy">Every order strengthens the platform</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slatecopy">
              Zuka Trust Scores run on a 300–850 scale, drawing on fulfillment history and behavioral signals —
              the same trust layer merchants see on their own dashboard.
            </p>
          </div>
          <div className="grid h-24 w-24 flex-none place-items-center rounded-full border-[10px] border-emerald text-xl font-black text-navy">
            850
          </div>
        </div>
      </Card>
    </div>
  );
}

export default AboutPage;