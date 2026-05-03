"use client";

import { UserButton } from "@clerk/nextjs";
import { UsagePanel } from "./UsagePanel";
import { t } from "@/lib/t";

function UsageIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export function UserButtonWithUsage() {
  return (
    <UserButton>
      <UserButton.UserProfilePage
        label={t.usage.tab_label}
        url="usage"
        labelIcon={<UsageIcon />}
      >
        <UsagePanel />
      </UserButton.UserProfilePage>
    </UserButton>
  );
}
