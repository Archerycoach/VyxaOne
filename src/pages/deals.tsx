import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DealsContainer } from "@/features/deals/components/DealsContainer";

export default function DealsPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <DealsContainer />
      </Layout>
    </ProtectedRoute>
  );
}