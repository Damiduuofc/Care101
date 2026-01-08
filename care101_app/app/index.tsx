import { Redirect } from "expo-router";

export default function Index() {
  // Always redirect to the ads page when the app opens.
  // In a real app, you might check an "isAuthenticated" state here.
  // If authenticated -> Redirect to /dashboard
  // If not -> Redirect to /ads

  return <Redirect href="/ads" />;
}