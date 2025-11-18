import React, { useState } from "react";
import { signUp, signIn, supabase } from "../supabaseClient.js";
import { useNavigate } from "react-router-dom";

//TODO: find some way to only allow professors to invite TAs and not anyone can sign up 
//sign up page 
export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");

    try {
      if (isSignUp) {
        await signUp(email, password);
        // @ts-ignore
        alert("Account created! Check your email for confirmation.");
      } else {
        await signIn(email, password);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) navigate("/dashboard");
      }
    } catch (err) {
      setErrorMessage(err.message);
    }
  }

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        background: "black",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#111",
          padding: "40px",
          borderRadius: "16px",
          width: "380px",
          boxShadow: "0 0 20px rgba(255,255,255,0.1)",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            color: "white",
            fontSize: "28px",
            marginBottom: "24px",
            fontWeight: "600",
          }}
        >
          {isSignUp ? "Sign Up" : "Login"}
        </h1>

        {errorMessage && (
          <p
            style={{
              color: "red",
              textAlign: "center",
              marginBottom: "12px",
            }}
          >
            {errorMessage}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "18px" }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              // @ts-ignore
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "none",
                background: "white",
                color: "black",
                fontSize: "16px",
              }}
              required
            />
          </div>

          <div style={{ marginBottom: "18px" }}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              // @ts-ignore
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "none",
                background: "white",
                color: "black",
                fontSize: "16px",
              }}
              required
            />
          </div>

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "12px",
              background: "white",
              color: "black",
              fontWeight: "600",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
              marginTop: "10px",
            }}
          >
            {isSignUp ? "Create Account" : "Log In"}
          </button>
        </form>

        <p
          style={{
            marginTop: "20px",
            textAlign: "center",
            color: "#ccc",
            fontSize: "14px",
          }}
        >
          {isSignUp ? "Already have an account?" : "Don’t have an account?"}{" "}
          <span
            onClick={() => setIsSignUp(!isSignUp)}
            style={{
              color: "white",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            {isSignUp ? "Log In" : "Sign Up"}
          </span>
        </p>
      </div>
    </div>
  );
}
