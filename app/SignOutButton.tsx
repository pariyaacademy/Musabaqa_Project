"use client";

import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";

export default function SignOutButton({ label = "Sign out" }: { label?: string }) {
  const router = useRouter();
  async function handleSignOut() {
    const supabase = getBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <button onClick={handleSignOut} className="hover:text-forest dark:text-forest-light">
      {label}
    </button>
  );
}
