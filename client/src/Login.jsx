import { useState } from 'react';
import { supabase } from './supabaseClient';
import ThemeToggle from './components/ThemeToggle';
import PasswordField from './components/PasswordField';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState('sign-in');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [signupSent, setSignupSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (mode === 'sign-up' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'sign-in') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      } else {
        // Explicit redirect target so the confirmation link always points back to
        // wherever this signup actually happened, instead of Supabase's static
        // dashboard "Site URL" (which is easy to leave pointed at localhost).
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        // A session means email confirmation is disabled on this project — the user is already in.
        if (!data.session) setSignupSent(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  }

  if (signupSent) {
    return (
      <div className="auth-page">
        <ThemeToggle />
        <div className="auth-card">
          <div className="brand">
            <h1>AI Document Assistant</h1>
            <div className="accent-line" />
          </div>
          <div className="notice">
            We've sent a confirmation link to <strong>{email}</strong>. Check your inbox (and spam
            folder), then click the link to activate your account and sign in.
          </div>
          <button className="btn-secondary" onClick={() => { setSignupSent(false); switchMode('sign-in'); }}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <ThemeToggle />
      <div className="auth-card">
        <div className="brand">
          <h1>AI Document Assistant</h1>
          <div className="accent-line" />
        </div>
        <div className="auth-mode fade-in" key={mode}>
          <span className="subtitle">{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</span>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <PasswordField
              id="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            />
            {mode === 'sign-up' && (
              <PasswordField
                id="confirm-password"
                label="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
                autoComplete="new-password"
              />
            )}
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Sign up'}
            </button>
            {error && <p className="error">{error}</p>}
          </form>
          <button
            className="link-button"
            onClick={() => switchMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
          >
            {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
