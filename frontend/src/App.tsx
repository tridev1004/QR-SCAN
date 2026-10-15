import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { AdminLoginRoute, RequireAdmin } from "./auth/guards";
import { LoginPage } from "./auth/LoginPage";
import { SignupPage } from "./auth/SignupPage";
import { VerifyEmailPage } from "./auth/VerifyEmailPage";
import { HomeRedirect, Layout } from "./components/Layout";
import { AdminPaymentsPage } from "./features/payments/pages/AdminPaymentsPage";
import { AdminPayoutsPage } from "./features/payments/pages/AdminPayoutsPage";
import { EmployeePaymentsPage } from "./features/payments/pages/EmployeePaymentsPage";
import { EmployeePayoutPage } from "./features/payments/pages/EmployeePayoutPage";
import { PaymentDetailsPage } from "./features/payments/pages/PaymentDetailsPage";
import { AdminCreateEmployeePage } from "./features/users/AdminCreateEmployeePage";
import { AdminUsersPage } from "./features/users/AdminUsersPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage portal="employee" />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/admin/login" element={<AdminLoginRoute />} />
      <Route path="/admin" element={<RequireAdmin />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/new" element={<AdminCreateEmployeePage />} />
            <Route path="payments" element={<AdminPaymentsPage />} />
            <Route path="payouts" element={<AdminPayoutsPage />} />
          <Route path="payments/:paymentSessionId" element={<PaymentDetailsPage />} />
        </Route>
      </Route>
      <Route element={<Layout />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/dashboard" element={<EmployeePaymentsPage />} />
        <Route path="/payout" element={<EmployeePayoutPage />} />
        <Route path="/payments/:paymentSessionId" element={<PaymentDetailsPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
