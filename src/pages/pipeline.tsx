import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PipelineContainer } from "@/features/pipeline/components/PipelineContainer";

export default function PipelinePage() {
  return (
    <ProtectedRoute>
      <Layout>
        <PipelineContainer />
      </Layout>
    </ProtectedRoute>
  );
}