import { CalendarClock, Gauge, ImageUp, Send, TrendingUp } from "lucide-react";
import { ChangeEvent, FormEvent, ReactElement, useEffect, useState } from "react";
import { Card, PageHeader } from "../components/Layout";
import { createScheduledDrop, getMerchantDashboard } from "../lib/api";
import { formatNaira } from "../state/ZukkaContext";

type MerchantDashboardSummary = {
  merchant: {
    id: string;
    business_name: string;
    sector?: string;
    zuka_trust_score: number;
  };
  metrics: {
    gmv: number;
    completed_orders: number;
    delivery_integrity: string;
  };
  scheduled_drops: Array<{
    id: string;
    caption: string;
    hashtags: string;
    media: string;
    scheduledFor: string;
    status: string;
  }>;
  sector_news?: {
    sector: string;
    generatedAt: string;
    headlines: Array<{ title: string; summary: string; signal: string }>;
    insights: string[];
    nextUpdate: string;
  };
};

export function MerchantDashboard() {
  const [dashboard, setDashboard] = useState<MerchantDashboardSummary | null>(null);
  const [caption, setCaption] = useState("NEW DROP: Limited Ankara totes. DM 'TOTE' to lock yours.");
  const [hashtags, setHashtags] = useState("#LagosFashion #AnkaraStyles #ZukkaDrop");
  const [media, setMedia] = useState("");
  const [mediaName, setMediaName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingDrop, setSubmittingDrop] = useState(false);
  const [channel, setChannel] = useState<"instagram" | "whatsapp">("instagram");
  const [scheduledFor, setScheduledFor] = useState("");
  const trustScore = dashboard?.merchant?.zuka_trust_score ?? 850;

  useEffect(() => {
    let isActive = true;

    getMerchantDashboard()
      .then((data) => {
        if (isActive) {
          setDashboard(data);
        }
      })
      .catch((dashboardError) => {
        if (isActive) {
          setError(dashboardError instanceof Error ? dashboardError.message : "Unable to load the backend dashboard.");
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const submitDrop = async (event: FormEvent) => {
    event.preventDefault();
    setSubmittingDrop(true);
    setError(null);

    try {
      const scheduledForIso = scheduledFor ? new Date(scheduledFor).toISOString() : undefined;

      const response = await createScheduledDrop({
        caption,
        hashtags,
        media_url: media || "/home/social-shopping.png",
        scheduled_for: scheduledForIso ?? null,
        channel
      });

      setDashboard((current) => current
        ? { ...current, scheduled_drops: [response.drop, ...current.scheduled_drops] }
        : current);
      setCaption("NEW DROP: Limited Ankara totes. DM 'TOTE' to lock yours.");
      setHashtags("#LagosFashion #AnkaraStyles #ZukkaDrop");
      setMedia("");
      setMediaName("");
    } catch (dropError) {
      setError(dropError instanceof Error ? dropError.message : "Unable to save the drop to the backend.");
    } finally {
      setSubmittingDrop(false);
    }
  };

  const uploadMedia = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setMedia(String(reader.result));
      setMediaName(file.name);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="relative overflow-hidden bg-black pb-24">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-24 right-0 h-[36rem] w-[36rem] rounded-full opacity-80 blur-3xl"
          style={{
            background: "radial-gradient(circle at 70% 30%, #7CC7E8 0%, rgba(124,199,232,0.35) 35%, rgba(124,199,232,0) 70%)"
          }}
        />
        <div
          className="absolute -bottom-32 -left-24 h-[34rem] w-[34rem] rounded-full opacity-80 blur-3xl"
          style={{
            background: "radial-gradient(circle at 30% 70%, #F59E0B 0%, rgba(245,158,11,0.3) 35%, rgba(245,158,11,0) 70%)"
          }}
        />
      </div>

      <div className="relative z-10 px-6 pt-10">
        <div className="flex items-center justify-between gap-6">
  <PageHeader
    title="Performance & Intelligence Dashboard"
    copy={dashboard?.merchant?.business_name ? `Live data for ${dashboard.merchant.business_name}.` : "A live command layer for GMV, trust, social proof drops, and local trend signals."}
  />
  <img
    src="/logo/Gold_Modern_Real_Estate_Company_Logo-removebg-preview.png"
    alt="Zukka"
    className="hidden h-32 w-auto flex-none opacity-90 md:block lg:h-40"
  />
</div>
        {loading ? <p className="mb-4 text-sm font-black text-slatecopy">Connecting to the backend dashboard...</p> : null}
        {error ? <p className="mb-4 text-sm font-black text-rose-600">{error}</p> : null}
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Total transactions value" value={formatNaira(dashboard?.metrics?.gmv ?? 0)} icon={<TrendingUp />} />
          <Metric label="Completed Orders" value={String(dashboard?.metrics?.completed_orders ?? 0)} icon={<Send />} />
          <Metric label="Delivery Integrity" value={dashboard?.metrics?.delivery_integrity ?? "96%"} icon={<CalendarClock />} />
          <Card>
            <div className="flex items-center gap-4">
              <div className="grid h-20 w-20 place-items-center rounded-full border-[10px] border-emerald text-xl font-black text-navy">{trustScore}</div>
              <div>
                <p className="text-xs font-black uppercase text-slatecopy">Zukka Trust Score</p>
                <p className="font-black text-navy">Excellent</p>
                <p className="text-xs text-slatecopy">Scale 300-850</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-xl font-black text-navy"><Send size={20} /> Zukka Post Signals</h2>
            <p className="mb-5 text-sm text-slatecopy">Auto-scheduled posting, timed for maximum reach.</p>
            <form onSubmit={submitDrop} className="space-y-4">
              <label className="block text-sm font-black text-navy">
                Caption
                <textarea className="mt-2 min-h-24 w-full rounded-md border border-slate-200 p-3" value={caption} onChange={(event) => setCaption(event.target.value)} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-black text-navy">
                  Trigger hashtags
                  <input className="mt-2 w-full rounded-md border border-slate-200 p-3" value={hashtags} onChange={(event) => setHashtags(event.target.value)} />
                </label>
                <div className="block text-sm font-black text-navy">
                  Upload drop image
                  <label className="mt-2 flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed border-skybrand bg-skybrand/10 p-3 text-navy">
                    <span className="inline-flex min-w-0 items-center gap-2 truncate"><ImageUp size={18} /> {mediaName || "Choose image from device"}</span>
                    <input type="file" accept="image/*" className="sr-only" onChange={uploadMedia} />
                  </label>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-black text-navy">
                  Post to
                  <select className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 outline-none" value={channel} onChange={(e) => setChannel(e.target.value as "instagram" | "whatsapp") }>
                    <option value="instagram">Instagram</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </label>
                <label className="block text-sm font-black text-navy">
                  Schedule for
                  <input
                    type="datetime-local"
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 outline-none"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                  />
                </label>
              </div>
              {media ? (
                <div className="rounded-md border border-slate-200 bg-mist p-3">
                  <p className="mb-2 text-xs font-black uppercase text-slatecopy">Upload preview</p>
                  <img src={media} alt="Scheduled drop upload preview" className="h-48 w-full rounded-md object-cover" />
                </div>
              ) : null}
              <button disabled={submittingDrop} className="rounded-md bg-navy px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-70">
                {submittingDrop ? "Saving..." : "Schedule & Publish Live Drop"}
              </button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-4 text-xl font-black text-navy">Scheduled Drops</h2>
            {(dashboard?.scheduled_drops ?? []).length === 0 ? <p className="text-sm text-slatecopy">No drops scheduled yet.</p> : null}
            <div className="space-y-3">
              {(dashboard?.scheduled_drops ?? []).map((drop) => (
                <div key={drop.id} className="rounded-md bg-mist p-3">
                  <img src={drop.media} alt="Scheduled drop media" className="mb-3 h-32 w-full rounded-md object-cover" />
                  <p className="font-bold text-navy">{drop.caption}</p>
                  <p className="mt-1 text-xs text-slatecopy">{drop.hashtags} - {drop.scheduledFor}</p>
                  <p className="mt-1 text-[11px] font-black uppercase text-slatecopy">{drop.status}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="mt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>Schedule a coordinated post and engagement spike to beat reach suppression
              <h2 className="mb-2 flex items-center gap-2 text-xl font-black text-navy"><Gauge size={20} /> Sector onboarding market mix</h2>
              <p className="text-sm text-slatecopy">The latest market signals for {dashboard?.merchant?.sector ?? "your selected sector"} refresh whenever you sign in.</p>
            </div>
            <span className="rounded-full bg-skybrand/15 px-3 py-1 text-xs font-black uppercase text-navy">{dashboard?.sector_news?.sector ?? "General"}</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(dashboard?.sector_news?.headlines ?? []).map((headline) => (
              <div key={headline.title} className="rounded-md border border-skybrand/20 bg-skybrand/10 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slatecopy">{headline.signal}</p>
                <p className="mt-2 font-black text-navy">{headline.title}</p>
                <p className="mt-2 text-sm text-slatecopy">{headline.summary}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md bg-mist p-4">
            <p className="text-xs font-black uppercase text-slatecopy">Signals to watch</p>
            <ul className="mt-3 space-y-2 text-sm text-slatecopy">
              {(dashboard?.sector_news?.insights ?? []).map((insight) => (
                <li key={insight} className="flex gap-2">
                  <span className="mt-2 h-2 w-2 rounded-full bg-skybrand" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactElement }) {
  return (
    <Card>
      <div className="mb-7 flex items-center justify-between">
        <p className="text-xs font-black uppercase text-slatecopy">{label}</p>
        <span className="rounded-md bg-skybrand/20 p-2 text-navy">{icon}</span>
      </div>
      <p className="text-3xl font-black text-navy">{value}</p>
    </Card>
  );
}