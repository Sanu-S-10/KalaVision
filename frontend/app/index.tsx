import { Redirect } from "expo-router";
import React from "react";

// Entry point — opens directly to the main dashboard without asking users to sign in.
export default function Index() {
  return <Redirect href="/(tabs)/dashboard" />;
}
