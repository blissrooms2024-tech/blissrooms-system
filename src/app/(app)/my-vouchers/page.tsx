import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import MyVouchersClient from "./MyVouchersClient";

export default async function MyVouchersPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  return <MyVouchersClient />;
}
