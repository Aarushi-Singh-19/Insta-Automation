import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <Routes>

<Route
  path="/"
  element={<Home />}
/>

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
  path="/privacy"
  element={<Privacy />}
/>

<Route
  path="/terms"
  element={<Terms />}
/>

<Route
  path="/contact"
  element={<Contact />}
/>

<Route
  path="/test"
  element={
    <div
      style={{
        background: "red",
        color: "white",
        minHeight: "100vh",
        fontSize: "50px",
        padding: "50px",
      }}
    >
      TEST ROUTE WORKING
    </div>
  }
/>

      </Routes>
    </BrowserRouter>
  );
}

export default App;