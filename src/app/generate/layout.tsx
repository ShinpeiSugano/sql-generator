import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function GenerateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/generate");
  }

  if (!session.user.email.endsWith("@xvolve.com")) {
    redirect("/login");
  }

  return <>{children}</>;
}
