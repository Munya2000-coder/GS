"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DEV_COOKIE } from "@/lib/auth";

/** Dev-mode sign-in: set the identity cookie (replaced by Entra ID SSO in production). */
export async function devLogin(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login?error=unknown-user");

  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  cookies().set(DEV_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 60-minute session (PRD §7.2)
  });
  redirect("/");
}

export async function logout() {
  cookies().delete(DEV_COOKIE);
  redirect("/login");
}
