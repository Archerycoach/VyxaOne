import { useState } from "react";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GoalsContainer } from "@/features/goals/components/GoalsContainer";

export default function GoalsPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <GoalsContainer />
      </Layout>
    </ProtectedRoute>
  );
}