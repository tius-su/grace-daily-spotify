import React from 'react';

export default function NotFound() {
  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'var(--background)',
      color: 'var(--foreground)',
      padding: '2rem',
    }}>
      <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>404 – Tidak Ditemukan</h1>
      <p style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>
        Halaman yang Anda cari tidak ada atau telah dipindahkan.
      </p>
      <a href="/" style={{
        padding: '0.75rem 1.5rem',
        background: '#2563eb',
        color: '#fff',
        borderRadius: '0.5rem',
        textDecoration: 'none',
        fontWeight: '600',
      }}>Kembali ke Beranda</a>
    </main>
  );
}
