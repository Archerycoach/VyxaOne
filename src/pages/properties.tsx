import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PropertiesContainer } from "@/features/properties/components/PropertiesContainer";

export default function PropertiesPage() {
  return (
    <ProtectedRoute>
      <Layout title="Gestão de Imóveis">
        <PropertiesContainer />
      </Layout>
    </ProtectedRoute>
  );
}