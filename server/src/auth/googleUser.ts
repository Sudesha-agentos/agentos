import { prisma } from "../db/client";
import { displayNameFromEmail } from "../api/routes/authSession";
import type { User } from "../generated/prisma/client";
import type { GoogleUserProfile } from "./googleOAuth";

export async function findOrCreateGoogleUser(
  profile: GoogleUserProfile
): Promise<{ user: User; isNewUser: boolean }> {
  const byGoogleId = await prisma.user.findUnique({
    where: { googleId: profile.sub },
  });
  if (byGoogleId) {
    if (byGoogleId.name !== profile.name) {
      const user = await prisma.user.update({
        where: { id: byGoogleId.id },
        data: { name: profile.name },
      });
      return { user, isNewUser: false };
    }
    return { user: byGoogleId, isNewUser: false };
  }

  const byEmail = await prisma.user.findUnique({
    where: { email: profile.email },
  });

  if (byEmail) {
    if (byEmail.googleId && byEmail.googleId !== profile.sub) {
      throw new Error("google_account_conflict");
    }
    const user = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleId: profile.sub,
        name: profile.name || byEmail.name,
      },
    });
    return { user, isNewUser: false };
  }

  const user = await prisma.user.create({
    data: {
      email: profile.email,
      name: profile.name || displayNameFromEmail(profile.email),
      googleId: profile.sub,
      passwordHash: null,
    },
  });
  return { user, isNewUser: true };
}
