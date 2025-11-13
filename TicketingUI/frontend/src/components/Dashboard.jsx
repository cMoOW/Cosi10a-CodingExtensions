import React from 'react';
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

export default function Dashboard() {
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
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    gap: "1rem",
    padding: "1rem",
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
};
