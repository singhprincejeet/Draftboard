import { redirect } from "next/navigation";
import { getAuthMode, isSSO } from "~/lib/auth-provider";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";
import { getDb } from "~/server/db";
import { CredentialsSignIn } from "./credentials-sign-in";
import { SSOSignIn } from "./sso-sign-in";

export default async function SignInPage() {
  if (!isSSO()) {
    const { env } = await getCloudflareContext();
    const db = getDb(env.DB);
    const userCount = await db.user.count();
    if (userCount === 0) {
      redirect("/sign-up");
    }
  }

  const authMode = getAuthMode();

  if (authMode === "credentials") {
    return <CredentialsSignIn />;
  }

  return <SSOSignIn authMode={authMode} />;
}
