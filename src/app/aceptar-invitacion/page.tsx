import { notFound, redirect } from "next/navigation";

import { ApiError } from "@/lib/api";
import { getInvitationState, tryGetCurrentUser } from "@/lib/auth";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";

type AceptarInvitacionPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function AceptarInvitacionPage({
  searchParams,
}: AceptarInvitacionPageProps) {
  const { token } = await searchParams;

  if (!token) {
    notFound();
  }

  const current = await tryGetCurrentUser();

  if (current) {
    redirect("/");
  }

  let invitation;

  try {
    invitation = await getInvitationState(token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_35%),linear-gradient(180deg,rgba(12,10,9,1),rgba(23,23,23,1))] px-4 py-10">
      <AcceptInvitationForm invitation={invitation} token={token} />
    </main>
  );
}
