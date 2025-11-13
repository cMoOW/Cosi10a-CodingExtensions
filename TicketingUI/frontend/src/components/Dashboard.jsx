import React from 'react';
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [noteCount, setNoteCount] = useState(0);

  useEffect(() => {
    fetchNoteCount();

    const channel = supabase
    .channel("realtime:notes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "tickets" },
      (payload) => {
        console.log("New note added:", payload.new);
        setNoteCount((prev) => prev + 1);
      }
    )
    .subscribe((status) => {
      console.log("Supabase Realtime subscription status:", status);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchNoteCount() {
    const { count, error } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true }); // only get count, no data


      if (error) {
        console.error("Error inserting note:", error);
      }
      else {
        console.log("Inserted ticket:", count);
        setNoteCount(count);
      }
  }

  return (
    <div 
// @ts-ignore
    style={styles.dashboard}>
      
      {/* Top-right button */}
      <button 
        // @ts-ignore
        style={styles.button}
        // @ts-ignore
        onClick={() => navigate("/tickets")}
      >
        View All Notes
      </button>
  
      <h1 style={styles.title}>Ticketing Dashboard</h1>
    
      <div 
// @ts-ignore
      style={styles.card}>
        <h3 style={styles.cardTitle}>Total Notes</h3>
        <p style={styles.cardCount}>{noteCount}</p>
      </div>
  
    </div>
  );
  
}

const styles = {
  dashboard: {
    position: "relative",
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "2rem",
    padding: "2rem",
    minHeight: "100vh",
  },
  headerRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between", 
    alignItems: "center",
    width: "100%",
  },
  title: {
    margin: 0,
    fontSize: "2rem",
    fontWeight: "bold",
  },
  card: {
    backgroundColor: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "1.5rem",
    width: "180px",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
  },
  cardTitle: {
    margin: 0,
    fontSize: "1rem",
    color: "#374151",
  },
  cardCount: {
    fontSize: "2rem",
    fontWeight: "bold",
    color: "#4f46e5",
    marginTop: "0.5rem",
  },
  button: {
    padding: "0.75rem 1.5rem",
    fontSize: "1rem",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#4f46e5",
    color: "white",
    cursor: "pointer",
  },
  topRightButton: {
    position: "absolute",
    top: "1.5rem",
    right: "2rem",
    padding: "0.75rem 1.5rem",
    fontSize: "1rem",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#4f46e5",
    color: "white",
    cursor: "pointer",
  },  
};
