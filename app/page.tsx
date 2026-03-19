"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Dashboard from "@/components/Dashboard";

const AUTH_KEY = "outreach-auth";

export default function Home() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(AUTH_KEY) === "true") {
      setAuthed(true);
    } else {
      router.push("/login");
    }
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!authed) return null;

  return <Dashboard />;
}
