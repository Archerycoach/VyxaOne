import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DevelopmentsContainer } from "@/features/developments/components/DevelopmentsContainer";

export default function DevelopmentsPage() {
  return (
    <ProtectedRoute>
      <Layout title="Gestão de Empreendimentos">
        <DevelopmentsContainer />
      </Layout>
    </ProtectedRoute>
  );
}