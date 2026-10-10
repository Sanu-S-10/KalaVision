import { Redirect } from "expo-router";
import React from "react";

// (tabs)/index redirects to the main Dashboard screen
export default function TabsIndex() {
  return <Redirect href="/(tabs)/dashboard" />;
}

