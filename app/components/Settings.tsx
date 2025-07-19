'use client';
import React, { useEffect, useState } from 'react';

export function Settings() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className="settings-container" style={{ position: 'absolute', top: 20, right: 20 }}>
      <label>
        <span style={{ marginRight: 8 }}>Theme:</span>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </div>
  );
}

export default Settings;
