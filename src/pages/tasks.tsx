import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { TasksContainer } from "@/features/tasks/components/TasksContainer";

export default function TasksPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <TasksContainer />
      </Layout>
    </ProtectedRoute>
  );
}