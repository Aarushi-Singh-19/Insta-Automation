import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

function FollowVerify() {
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState(
    "Verifying your follow..."
  );
  const verificationStarted = useRef(false);

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link.");
      return;
    }

    const verifyFollow = async () => {
  if (verificationStarted.current) {
    return;
  }

  verificationStarted.current = true;

  try {
        
          const response = await fetch(
  `${API_BASE_URL}/follow/verify-follow`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Verification failed."
          );
        }

        if (data.verified) {
          setStatus("success");
          setMessage(
            "You're following! Your DM is being unlocked."
          );
          return;
        }

        setStatus("not-following");
        setMessage(
          "You're not following the account yet. Follow the account on Instagram and try again."
        );
      } catch (error) {
        console.error(
          "Follow verification error:",
          error
        );

        setStatus("error");
        setMessage(
          error.message ||
            "Something went wrong while verifying your follow."
        );
      }
    };

    verifyFollow();
  }, [searchParams]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#f7f7f7",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "16px",
          padding: "32px",
          textAlign: "center",
          boxShadow:
            "0 10px 30px rgba(0, 0, 0, 0.08)",
        }}
      >
        <h1
          style={{
            marginBottom: "16px",
            fontSize: "24px",
          }}
        >
          {status === "checking" &&
            "Checking Follow Status..."}

          {status === "success" &&
            "Follow Verified ✓"}

          {status === "not-following" &&
            "Follow Required"}

          {status === "error" &&
            "Verification Failed"}
        </h1>

        <p
          style={{
            color: "#666",
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>

        {status === "not-following" && (
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "20px",
              padding: "12px 20px",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            I'm Following — Check Again
          </button>
        )}
      </div>
    </div>
  );
}

export default FollowVerify;