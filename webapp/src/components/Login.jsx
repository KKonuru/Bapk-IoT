import { useState } from 'react';

function RadarLogo() {
  return (
    <div className="radar-logo" aria-hidden="true">
      <div className="radar-ring" />
      <div className="radar-ring" />
      <div className="radar-ring" />
      <div className="radar-dot" />
      <div className="radar-pulse" />
      <div className="radar-pulse" />
      <div className="radar-sweep" />
    </div>
  );
}

function EmailIcon() {
  return (
    <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 4l6 4.5L14 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function Login({ onSignIn, onSignUp }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (isSignUp) {
        await onSignUp(email, password);
      } else {
        await onSignIn(email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-brand">
        <RadarLogo />
        <h1>SafeStep</h1>
        <p className="subtitle">Walk with confidence</p>
      </div>

      <form onSubmit={handleSubmit} className="login-form glass-card">
        <h2>{isSignUp ? 'Create Account' : 'Welcome back'}</h2>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <div className="input-wrapper">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-label="Email address"
              placeholder="your@email.com"
            />
            <EmailIcon />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="input-wrapper">
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-label="Password"
              placeholder="Enter password"
              minLength={6}
            />
            <LockIcon />
          </div>
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary">
          <span>{submitting ? 'Connecting...' : isSignUp ? 'Create Account' : 'Sign In'}</span>
        </button>

        <button
          type="button"
          className="btn-link"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError('');
          }}
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </form>
    </div>
  );
}
