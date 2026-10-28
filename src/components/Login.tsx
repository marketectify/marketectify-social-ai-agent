import { useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";
import type { Theme } from "../theme";

type View = "signin" | "signup" | "forgot";

const inputClass =
  "w-full h-11 px-3.5 rounded-xl bg-slate-100/50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all";

function Shell({ theme, onToggleTheme, children }: { theme: Theme; onToggleTheme: () => void; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <div className="flex justify-end p-4">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center glow-blue">
              <Zap className="w-5 h-5 text-white" fill="white" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Marketectify</h1>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium tracking-wider uppercase">
                AI Social Agent
              </p>
            </div>
          </div>
          <div className="glass rounded-2xl p-6 sm:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function Notice({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  const isError = kind === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm border ${
        isError
          ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
          : "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-400"
      }`}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full h-11 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {busy && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

export default function Login({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [view, setView] = useState<View>("signin");
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchView = (next: View) => {
    setView(next);
    setError(null);
    setInfo(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const cleanEmail = email.trim();
    if (view === "signup") {
      if (!workspaceName.trim()) return setError("Please enter your agency or brand name.");
      if (password.length < 8) return setError("Use a password with at least 8 characters.");
    }

    setBusy(true);
    try {
      if (view === "signin") {
        await signIn(cleanEmail, password);
      } else if (view === "signup") {
        const { needsConfirmation } = await signUp({
          email: cleanEmail,
          password,
          workspaceName: workspaceName.trim(),
        });
        if (needsConfirmation) {
          setInfo("Account created. Check your email and click the confirmation link, then sign in.");
          setView("signin");
          setPassword("");
        }
      } else {
        await resetPassword(cleanEmail);
        setInfo("If an account exists for this email, a reset link is on its way.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const title = view === "signin" ? "Welcome back" : view === "signup" ? "Create your account" : "Reset your password";
  const subtitle =
    view === "signin"
      ? "Sign in to manage your social media."
      : view === "signup"
        ? "Set up your workspace in under a minute."
        : "Enter your email and we will send you a reset link.";

  return (
    <Shell theme={theme} onToggleTheme={onToggleTheme}>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-sm text-slate-600 mt-1 mb-6">{subtitle}</p>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {view === "signup" && (
          <Field label="Agency or brand name">
            <input
              className={inputClass}
              type="text"
              autoComplete="organization"
              placeholder="e.g. Marketectify"
              value={workspaceName}
              maxLength={80}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
          </Field>
        )}

        <Field label="Email">
          <input
            className={inputClass}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        {view !== "forgot" && (
          <Field label="Password">
            <input
              className={inputClass}
              type="password"
              autoComplete={view === "signup" ? "new-password" : "current-password"}
              placeholder={view === "signup" ? "At least 8 characters" : "Your password"}
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}

        {error && <Notice kind="error">{error}</Notice>}
        {info && <Notice kind="success">{info}</Notice>}

        <SubmitButton busy={busy}>
          {view === "signin" ? "Sign in" : view === "signup" ? "Create account" : "Send reset link"}
        </SubmitButton>
      </form>

      <div className="mt-5 text-sm text-slate-600 flex flex-col items-center gap-2">
        {view === "signin" && (
          <>
            <button onClick={() => switchView("forgot")} className="text-blue-600 dark:text-blue-400 hover:underline">
              Forgot your password?
            </button>
            <span>
              New here?{" "}
              <button onClick={() => switchView("signup")} className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
                Create an account
              </button>
            </span>
          </>
        )}
        {view !== "signin" && (
          <button onClick={() => switchView("signin")} className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            Back to sign in
          </button>
        )}
      </div>
    </Shell>
  );
}

/** Shown after the user opens the link from the password-reset email. */
export function SetNewPassword({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    setBusy(true);
    try {
      await updatePassword(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell theme={theme} onToggleTheme={onToggleTheme}>
      <h2 className="text-xl font-bold">Choose a new password</h2>
      <p className="text-sm text-slate-600 mt-1 mb-6">You will stay signed in after saving.</p>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="New password">
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        <SubmitButton busy={busy}>Save password</SubmitButton>
      </form>
    </Shell>
  );
}
