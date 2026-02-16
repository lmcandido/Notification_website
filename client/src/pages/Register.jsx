import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(email, password, displayName || undefined);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Create account</h1>
        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}
          <label style={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Display name (optional)
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How others see you"
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
              style={styles.input}
            />
          </label>
          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? 'Creating account…' : 'Register'}
          </button>
        </form>
        <p style={styles.footer}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    background: '#fff',
    borderRadius: 12,
    padding: 32,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  title: { margin: '0 0 24px', fontSize: 24, fontWeight: 600 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  error: { color: '#b91c1c', fontSize: 14 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500 },
  input: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 15,
  },
  button: {
    marginTop: 8,
    padding: '12px 16px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
  },
  footer: { marginTop: 24, fontSize: 14, color: '#6b7280' },
};
