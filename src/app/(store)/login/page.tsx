import { redirect } from "next/navigation";

/**
 * The phone-OTP login that lived here is retired until an SMS sender is
 * approved (it's in git history). Sign-in now happens on /account, with
 * Google or as a guest.
 */
export default function LoginPage() {
  redirect("/account");
}
