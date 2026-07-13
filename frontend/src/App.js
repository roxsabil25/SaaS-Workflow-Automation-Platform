import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AuthCard from "./components/AuthCard";
import InvitedUserRegistration  from "./components/InvitedUserRegistration";
import { AuthProvider } from "./utils/authService";
import ProtectedRoute from "./utils/ProtectedRoute";
import Home from "./components/Home/Home";
import EditorPlaceholder from "./components/EditorPlaceholder";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<AuthCard />} />
          <Route path="/join/:token" element={<InvitedUserRegistration />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } />
          <Route path="/document/:docId" element={
            <ProtectedRoute>
              <EditorPlaceholder isDocument={true} mode="edit" />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;