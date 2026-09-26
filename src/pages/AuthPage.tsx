import { ArrowRight, BadgeCheck, CheckCircle, KeyRound, LockKeyhole, Mail, Store } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { PageKey } from "../App";
import { confirmPasswordReset, isSessionActive, loginMerchant, registerMerchant, requestPasswordReset } from "../lib/api";

const sectorOptions = [
  { label: "Fashion", value: "fashion" },
  { label: "Food", value: "food" },
  { label: "Beauty", value: "beauty" },
  { label: "Logistics", value: "logistics" },
  { label: "Health", value: "health" },
  { label: "Electronics", value: "electronics" },
  { label: "General", value: "general" }
];

type AuthMode = "signin" | "signup" | "forgot_password" | "reset_password";

export function AuthPage({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [sector, setSector] = useState("fashion");

  useEffect(() => {
    let mounted = true;

    // Check if user came from a password reset link (?reset_token=...)
    const searchParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = searchParams.get("reset_token");
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setMode("reset_password");
      return;
    }

    isSessionActive().then((active) => {
      if (mounted && active) onNavigate("dashboard");
    });

    return () => {
      mounted = false;
    };
  }, [onNavigate]);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      if (mode === "signup") {
        await registerMerchant({ business_name: businessName, email, phone, password, sector });
        setSubmitted(true);
        setStatusMessage("Merchant account registered! Opening your dashboard...");
        window.setTimeout(() => onNavigate("dashboard"), 700);
      } else if (mode === "signin") {
        await loginMerchant({ email, password });
        setSubmitted(true);
        setStatusMessage("Connected to the backend. Opening your dashboard...");
        window.setTimeout(() => onNavigate("dashboard"), 700);
      } else if (mode === "forgot_password") {
        const resp = await requestPasswordReset(email);
        setSubmitted(true);
        setStatusMessage(
          resp.message || "A password reset link has been dispatched to your email address."
        );
        if (resp.resetToken) {
          setResetToken(resp.resetToken);
        }
      } else if (mode === "reset_password") {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match. Please ensure both passwords are identical.");
        }
        if (password.length < 8) {
          throw new Error("New password must be at least 8 characters long.");
        }
        const resp = await confirmPasswordReset(resetToken, password);
        setSubmitted(true);
        setStatusMessage(resp.message || "Password updated successfully. You can now sign in.");
        window.setTimeout(() => {
          setMode("signin");
          setSubmitted(false);
          setPassword("");
          setConfirmPassword("");
          setStatusMessage("Password changed! Please log in with your new password.");
        }, 1500);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to process request.";
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
            {["Meta profile connection", "Naira checkout workspace", "LGA dispatch pooling"].map((item) => (
              <p key={item} className="flex items-center gap-2">
                <BadgeCheck size={17} className="text-skybrand" /> {item}
              </p>
            ))}
          </div>
        </div>

        <div className="p-6 md:p-10">
          {mode === "signin" || mode === "signup" ? (
            <div className="mb-8 inline-grid grid-cols-2 rounded-lg bg-mist p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setStatusMessage(null);
                  setSubmitted(false);
                }}
                className={`rounded-md px-5 py-3 text-sm font-black ${
                  mode === "signin" ? "bg-white text-navy shadow-sm" : "text-slatecopy"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setStatusMessage(null);
                  setSubmitted(false);
                }}
                className={`rounded-md px-5 py-3 text-sm font-black ${
                  mode === "signup" ? "bg-white text-navy shadow-sm" : "text-slatecopy"
                }`}
              >
                Sign up
              </button>
            </div>
          ) : (
            <div className="mb-8">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setStatusMessage(null);
                  setSubmitted(false);
                }}
                className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slatecopy hover:text-navy"
              >
                ← Back to Login
              </button>
            </div>
          )}

          <h2 className="text-3xl font-black text-navy">
            {mode === "signin"
              ? "Welcome back"
              : mode === "signup"
              ? "Create your merchant account"
              : mode === "forgot_password"
              ? "Retrieve your password"
              : "Set new password"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slatecopy">
            {mode === "signin"
              ? "Continue to your Zukka operating dashboard."
              : mode === "signup"
              ? "Start with your business identity and connect channels next."
              : mode === "forgot_password"
              ? "Enter your registered email address to receive a secure password retrieval link."
              : "Enter and confirm your new account password below."}
          </p>

          <form onSubmit={submitAuth} className="mt-7 space-y-4">
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

            {mode !== "reset_password" ? (
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
            ) : null}

            {mode === "signin" || mode === "signup" ? (
              <div>
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

                {mode === "signin" ? (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot_password");
                        setStatusMessage(null);
                        setSubmitted(false);
                      }}
                      className="text-xs font-bold text-navy hover:text-skybrand hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {mode === "reset_password" ? (
              <>
                {!resetToken ? (
                  <label className="block text-sm font-black text-navy">
                    Reset token
                    <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-200 px-3">
                      <KeyRound size={18} className="text-slatecopy" />
                      <input
                        required
                        className="w-full py-3 outline-none"
                        placeholder="Paste reset token from email"
                        value={resetToken}
                        onChange={(event) => setResetToken(event.target.value)}
                      />
                    </span>
                  </label>
                ) : null}
                <label className="block text-sm font-black text-navy">
                  New password (min 8 characters)
                  <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-200 px-3">
                    <LockKeyhole size={18} className="text-slatecopy" />
                    <input
                      required
                      type="password"
                      className="w-full py-3 outline-none"
                      placeholder="Enter new password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </span>
                </label>
                <label className="block text-sm font-black text-navy">
                  Confirm new password
                  <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-200 px-3">
                    <LockKeyhole size={18} className="text-slatecopy" />
                    <input
                      required
                      type="password"
                      className="w-full py-3 outline-none"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                  </span>
                </label>
              </>
            ) : null}

            <button
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-navy px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading
                ? "Processing..."
                : mode === "signin"
                ? "Login to dashboard"
                : mode === "signup"
                ? "Create account"
                : mode === "forgot_password"
                ? "Send retrieval email"
                : "Save new password"}{" "}
              <ArrowRight size={18} />
            </button>

            {submitted && mode === "forgot_password" ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="flex items-center gap-2 font-bold">
                  <CheckCircle size={18} className="text-emerald-600" />
                  Retrieval email dispatched!
                </p>
                <p className="mt-1 text-xs text-emerald-700 leading-relaxed">
                  {statusMessage} Check your email (or server log in test mode) for the link.
                </p>
                {resetToken ? (
                  <button
                    type="button"
                    onClick={() => setMode("reset_password")}
                    className="mt-3 inline-block rounded bg-navy px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Proceed to reset password →
                  </button>
                ) : null}
              </div>
            ) : null}

            {submitted && mode !== "forgot_password" ? (
              <p className="text-center text-sm font-black text-emerald">
                {statusMessage ?? "Success. Opening merchant dashboard..."}
              </p>
            ) : null}

            {!submitted && statusMessage ? (
              <p className="text-center text-sm font-black text-rose-600">{statusMessage}</p>
            ) : null}
          </form>
        </div>
      </section>
    </div>
  );
}
