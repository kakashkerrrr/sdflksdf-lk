import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getUserByEmail, upsertUserFromProfile, getRemainingCredits } from "../../../lib/user";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      await upsertUserFromProfile(user);
      return true;
    },
    async session({ session }) {
      const email = session?.user?.email;
      const dbUser = await getUserByEmail(email);

      if (dbUser) {
        const remaining = getRemainingCredits(dbUser);
        session.user.id = dbUser.id;
        session.user.isAdmin = dbUser.is_admin;
        session.user.credits = {
          total: dbUser.total_credits,
          used: dbUser.used_credits,
          remaining,
        };
      }

      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
