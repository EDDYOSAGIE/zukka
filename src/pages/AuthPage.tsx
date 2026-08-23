import { ArrowRight, BadgeCheck, LockKeyhole, Mail, Store } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { PageKey } from "../App";
import { isSessionActive, loginMerchant, registerMerchant } from "../lib/api";

const sectorOptions = [
  { label: "Fashion", value: "fashion" },
  { label: "Food", value: "food" },
  { label: "Beauty", value: "beauty" },
  { label: "Logistics", value: "logistics" },
  { label: "Health", value: "health" },
  { label: "Electronics", value: "electronics" },
  { label: "General", value: "general" }
];

export function AuthPage({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sector, setSector] = useState("fashion");

  useEffect(() => {
    let mounted = true;
    isSessionActive().then((active) => {
      if (mounted && active) onNavigate("dashboard");
    });
    return () => {
      mounted = false;
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const response = mode === "signup"
        ? await registerMerchant({ business_name: businessName, email, phone, password, sector })
        : await loginMerchant({ email, password });

      // Backend should set a secure httpOnly session cookie; navigate once successful
      setSubmitted(true);
      setStatusMessage("Connected to the backend. Opening your dashboard...");
      window.setTimeout(() => onNavigate("dashboard"), 700);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to authenticate with the backend.";
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-40px)] place-items-center pb-24">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-calm lg:grid-cols-[0.95fr_1.05fr]">
        <div className="bg-navy p-8 text-white md:p-10">
          <button onClick={() => onNavigate("home")} className="mb-12 flex items-center gap-3 text-left">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-skybrand font-black text-navy">Z</span>
            <span>
              <span className="block text-xl font-black">Zukka</span>
              <span className="text-sm text-sky-100">Merchant access</span>
            </span>
          </button>
          <h1 className="mt-4 text-4xl font-black leading-tight md:text-5xl">
            Zukka: The Premier Platform for social media merchants
          </h1>
          <div className="mt-8 space-y-3 text-sm text-sky-50">
            {['Meta profile connection', 'Naira checkout workspace', 'LGA dispatch pooling'].map((item) => (
              <p key={item} className="flex items-center gap-2">
                <BadgeCheck size={17} className="text-skybrand" /> {item}
              </p>
            ))}
          </div>
        </div>

        <div className="p-6 md:p-10">
          <div className="mb-8 inline-grid grid-cols-2 rounded-lg bg-mist p-1">
            <button
              onClick={() => setMode("signin")}
              className={`rounded-md px-5 py-3 text-sm font-black ${mode === "signin" ? "bg-white text-navy shadow-sm" : "text-slatecopy"}`}
            >
              Login
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`rounded-md px-5 py-3 text-sm font-black ${mode === "signup" ? "bg-white text-navy shadow-sm" : "text-slatecopy"}`}
            >
              Sign up
            </button>
          </div>

          <h2 className="text-3xl font-black text-navy">{mode === "signin" ? "Welcome back" : "Create your merchant account"}</h2>
          <p className="mt-2 text-sm leading-6 text-slatecopy">
            {mode === "signin" ? "Continue to your Zukka operating dashboard." : "Start with your business identity and connect channels next."}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {mode === "signup" ? (
              <>
                <label className="block text-sm font-black text-navy">
                  Business name
                  <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-200 px-3">
                    <Store size={18} className="text-slatecopy" />
                    <input
                      required
                      className="w-full py-3 outline-none"
                      placeholder="e.g. Ada Lagos Styles"
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                    />
                  </span>
                </label>
                <label className="block text-sm font-black text-navy">
                  Phone number
                  <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-200 px-3">
                    <Store size={18} className="text-slatecopy" />
                    <input
                      required
                      className="w-full py-3 outline-none"
                      placeholder="e.g. +2348012345678"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </span>
                </label>
                <label className="block text-sm font-black text-navy">
                  Sector for onboarding
                  <select
                    required
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 outline-none"
                    value={sector}
                    onChange={(event) => setSector(event.target.value)}
                  >
                    {sectorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            <label className="block text-sm font-black text-navy">
              Email address
              <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-200 px-3">
                <Mail size={18} className="text-slatecopy" />
                <input
                  required
                  type="email"
                  className="w-full py-3 outline-none"
                  placeholder="merchant@zukka.shop"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </span>
            </label>
            <label className="block text-sm font-black text-navy">
              Password
              <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-200 px-3">
                <LockKeyhole size={18} className="text-slatecopy" />
                <input
                  required
                  type="password"
                  className="w-full py-3 outline-none"
                  placeholder="Enter password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </span>
            </label>
            <button disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-navy px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-70">
              {loading ? "Connecting..." : mode === "signin" ? "Login to dashboard" : "Create account"} <ArrowRight size={18} />
            </button>
            {submitted ? <p className="text-center text-sm font-black text-emerald">{statusMessage ?? "Success. Opening merchant dashboard..."}</p> : null}
            {!submitted && statusMessage ? <p className="text-center text-sm font-black text-rose-600">{statusMessage}</p> : null}
          </form>
        </div>
      </section>
    </div>
  );
}
