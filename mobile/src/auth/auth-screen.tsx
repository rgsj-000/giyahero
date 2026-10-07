import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Browser } from "@capacitor/browser";
export function AuthScreen({
  client,
  onAuthenticated,
  error: linkError = "",
  onClose,
}: {
  client: SupabaseClient;
  onAuthenticated: () => Promise<void>;
  error?: string;
  onClose: () => void;
}) {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (register) {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: import.meta.env.VITE_AUTH_CALLBACK_URL,
            data: { full_name: name.trim() },
          },
        });
        if (error) throw new Error(error.message);
        if (data.session) await onAuthenticated();
        else
          setNotice(
            "Check your email to confirm your account. If you open the link on another device, return here and sign in with your password.",
          );
      } else {
        const { error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw new Error(error.message);
        await onAuthenticated();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: import.meta.env.VITE_AUTH_CALLBACK_URL,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw new Error(error.message);
      if (!data.url) throw new Error("Google sign-in is unavailable.");
      await Browser.open({ url: data.url });
      setNotice("Finish sign-in in your browser, then return to GiyaHero.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="gh-marketplace gh-auth">
      <h1>{register ? "Create an account" : "Sign in to GiyaHero"}</h1>
      <p>Your trips and agency workspace stay with your account.</p>
      {linkError && <p role="alert">{linkError}</p>}
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          {register && (
            <label>
              Full name
              <input
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={register ? 8 : 1}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <button className="gh-action gh-orange gh-wide" disabled={busy}>
          {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
        </button>
      </form>
      <div className="gh-form-actions">
        <button
          className="gh-action gh-secondary"
          disabled={busy}
          onClick={google}
        >
          Continue with Google
        </button>
        <button
          className="gh-action gh-secondary"
          disabled={busy}
          onClick={() => {
            setRegister(!register);
            setError("");
            setNotice("");
          }}
        >
          {register ? "Already have an account" : "Create an account"}
        </button>
        <button
          className="gh-action gh-secondary"
          disabled={busy}
          onClick={onClose}
        >
          Back to explore
        </button>
      </div>
    </main>
  );
}
