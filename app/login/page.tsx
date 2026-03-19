"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const APP_PASSWORD = "seed1M";
const AUTH_KEY = "outreach-auth";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === APP_PASSWORD) {
      localStorage.setItem(AUTH_KEY, "true");
      router.push("/");
    } else {
      setError("Wrong password");
      setPassword("");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-10 max-w-sm w-full text-center shadow-sm border border-gray-200">
        <div className="w-14 h-14 bg-[#7832E6] rounded-xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-purple-200">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-1.5">Outreach Tracker</h1>
        <p className="text-gray-400 text-sm mb-6">Enter password to continue</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="Password"
            autoFocus
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all bg-gray-50 placeholder:text-gray-400"
          />
          {error && <p className="text-rose-500 text-xs font-medium">{error}</p>}
          <button
            type="submit"
            className="w-full px-4 py-3 bg-[#7832E6] text-white rounded-lg text-sm font-medium hover:bg-[#6526C7] transition-colors"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
