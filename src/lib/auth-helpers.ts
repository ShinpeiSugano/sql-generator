import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function getSession() {
  return await auth();
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (!session) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session.user as any).role;
  if (role !== "admin") {
    return null;
  }
  return session;
}

export function unauthorizedResponse(message = "認証が必要です") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = "権限がありません") {
  return NextResponse.json({ error: message }, { status: 403 });
}
