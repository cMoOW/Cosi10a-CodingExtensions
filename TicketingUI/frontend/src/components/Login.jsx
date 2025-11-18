import React, { useState } from "react";
import { signIn } from "../supabaseClient.js";
import { useNavigate } from "react-router-dom";

//log in page 
export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);

    try {
      await signIn(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Login</h1>

        {error && (
          <p className="text-red-500 text-center mb-4">{error}</p>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            // @ts-ignore
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
            className="border p-3 rounded-xl focus:outline-none"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            // @ts-ignore
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
            className="border p-3 rounded-xl focus:outline-none"
          />

          <button
            type="submit"
            className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition"
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}
