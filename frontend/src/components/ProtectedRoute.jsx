import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ user }) {
  const location = useLocation();

  if (!user) {
    // Redirect to /login if not authenticated, keeping track of intended path
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
