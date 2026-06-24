import DashboardLayout from "../components/DashboardLayout";

function Settings() {
  return (
    <DashboardLayout>
<h1>Settings</h1>

<p style={{ color: "#6b7280" }}>
  Manage your account and preferences.
</p>

<div
  style={{
    border: "1px solid #e5e7eb",
    padding: "24px",
    borderRadius: "16px",
    marginTop: "24px",
  }}
>
  <h2>Profile</h2>

  <p>
    <strong>Name:</strong> Test User
  </p>

  <p>
    <strong>Email:</strong> test@gmail.com
  </p>
</div>

<div
  style={{
    border: "1px solid #e5e7eb",
    padding: "24px",
    borderRadius: "16px",
    marginTop: "24px",
  }}
>
  <h2>Instagram Account</h2>

  <p>Status: Connected ✅</p>

  <button
    style={{
      padding: "10px 16px",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      background: "#E1306C",
      color: "white",
    }}
  >
    Reconnect Instagram
  </button>
</div>

<div
  style={{
    border: "1px solid #e5e7eb",
    padding: "24px",
    borderRadius: "16px",
    marginTop: "24px",
  }}
>
  <h2>Subscription</h2>

  <p>Current Plan: Trial</p>

  <button
    style={{
      padding: "10px 16px",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      background: "#F59E0B",
      color: "white",
    }}
  >
    Upgrade Plan
  </button>
</div>

<div
  style={{
    border: "1px solid #FCA5A5",
    padding: "24px",
    borderRadius: "16px",
    marginTop: "24px",
  }}
>
  <h2>Danger Zone</h2>

  <button
    style={{
      padding: "10px 16px",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      background: "#DC2626",
      color: "white",
    }}
  >
    Logout
  </button>
</div>
    </DashboardLayout>
  );
}

export default Settings;