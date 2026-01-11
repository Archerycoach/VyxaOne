import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ContactsContainer } from "@/features/contacts/components/ContactsContainer";

export default function ContactsPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <ContactsContainer />
      </Layout>
    </ProtectedRoute>
  );
}