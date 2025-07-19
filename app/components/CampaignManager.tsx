"use client";
import React, { useState, useEffect } from "react";
import styles from "./Button.module.css";

export default function CampaignManager({ onSelect }: { onSelect: (id: string) => void }) {
  const [campaigns, setCampaigns] = useState([]);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetch("/api/campaigns")
      .then(res => res.json())
      .then(setCampaigns);
  }, []);

  const createCampaign = async () => {
    const res = await fetch("/api/campaigns", {
      method: "POST",
      body: JSON.stringify({ name: newName }),
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      const newCampaign = await res.json();
      setCampaigns([newCampaign, ...campaigns]);
      setNewName("");
    } else {
      alert(await res.text());
    }
  };

  return (
    <>
      <h2>Select a Campaign</h2>
      <ul>
        {campaigns.map((c) => (
          <li key={c._id}>
            <button onClick={() => onSelect(c._id)}>{c.name}</button>
          </li>
        ))}
      </ul>

      <h3>Create New Campaign</h3>
      <input
        id="campaign-name-input"
        type="text"
        placeholder="Campaign name"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
      />
      <button className={styles.button} onClick={createCampaign}>Create Campaign</button>
    </>
  );
}
