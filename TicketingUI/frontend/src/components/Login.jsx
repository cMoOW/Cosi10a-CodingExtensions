import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if(error){
        alert("Error logging in: " + error.message);
        return;
    }

    onLogin(email, password); // Send email back to App
  };

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "black",
      color: "white",
      flexDirection: "column"
    }}>
      <h2 style={{ marginBottom: "20px" }}>Login</h2>

      <form onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        <input
          type="email"
          placeholder="Enter your TA email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            padding: "12px",
            width: "250px",
            borderRadius: "6px",
            border: "none",
            color: "black"
          }}
        />

        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            padding: "12px",
            width: "250px",
            borderRadius: "6px",
            border: "none",
            color: "black"
          }}
        />

        <button
          type="submit"
          style={{
            padding: "10px",
            background: "white",
            color: "black",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Log In
        </button>
      </form>
    </div>
  );
}
