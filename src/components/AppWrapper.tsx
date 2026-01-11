import { useRouter } from "next/router";
import { ProtectedRoute } from "./ProtectedRoute";

interface AppWrapperProps {
  children: React.ReactNode;
}

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/landing",
  "/login",
  "/forgot-password",
  "/features",
  "/pricing",
  "/use-cases",
  "/about",
  "/contact",
  "/documentation",
  "/faq",
  "/support",
  "/privacy-policy"
];

// Admin routes that require admin role
const ADMIN_ROUTES = [
  "/admin/dashboard",
  "/admin/users",
  "/admin/subscriptions",
  "/admin/payment-settings",
  "/admin/security",
  "/admin/workflows",
  "/admin/system-settings",
  "/admin/integrations",
  "/admin/frontend-settings"
];

export function AppWrapper({ children }: AppWrapperProps) {
  const router = useRouter();
  const currentPath = router.pathname;

  // Check if current route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    currentPath === route || currentPath.startsWith(route)
  );

  // Check if current route requires admin role
  const isAdminRoute = ADMIN_ROUTES.some(route => 
    currentPath === route || currentPath.startsWith(route)
  );

  // Public routes don't need protection
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Admin routes need role check
  if (isAdminRoute) {
    return (
      <ProtectedRoute allowedRoles={["admin"]}>
        {children}
      </ProtectedRoute>
    );
  }

  // All other routes require authentication
  return <ProtectedRoute>{children}</ProtectedRoute>;
}