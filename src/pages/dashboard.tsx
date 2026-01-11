import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardContainer } from "@/features/dashboard/components/DashboardContainer";

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <Layout>
        <DashboardContainer />
      </Layout>
    </ProtectedRoute>
  );
}