import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CalendarContainer } from "@/features/calendar/components/CalendarContainer";

export default function CalendarPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <CalendarContainer />
      </Layout>
    </ProtectedRoute>
  );
}