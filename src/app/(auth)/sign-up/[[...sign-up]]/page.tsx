import { SignUp } from "@clerk/nextjs";

// Invite-only: Clerk should be configured to disable public sign-ups in the
// dashboard. This page exists so invited users can complete onboarding.
export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <SignUp />
    </main>
  );
}
