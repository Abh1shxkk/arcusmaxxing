"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ADDRESS_RE, useTracker } from "@/components/TrackerProvider";

export function OpenShared({ address }: { address: string }) {
  const { open } = useTracker();
  const router = useRouter();
  useEffect(() => {
    if (ADDRESS_RE.test(address)) open(address);
    router.replace("/card");
  }, [address, open, router]);
  return <p className="py-20 text-center text-ink-2">Opening trader card…</p>;
}
