"use client";

import Image from "next/image";
import Logo  from "./components/Logo";
import Bubble from "./components/Bubble";
import LoadingBubble from "./components/loading";
import PromptSuggestions from "./components/PromptSuggestions";
import { useState, useEffect } from "react";
import CampaignManager from "./components/CampaignManager"
import  InformationPopUp  from "./components/InformationPopUp";
import Settings from "./components/Settings";

// Define Message type locally
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

const Home = () => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  // Fetch past messages when campaignId changes
  useEffect(() => {
    if (!campaignId) return;
    (async () => {
      try {
        const res = await fetch(`/api/chat?campaignId=${encodeURIComponent(campaignId)}`);
        if (res.ok) {
          const data = await res.json();
          // Defensive: ensure messages are in the right format
          const loaded = Array.isArray(data)
            ? data.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: m.timestamp,
              }))
            : [];
          setMessages(loaded);
        }
      } catch (err) {
        console.error("Failed to load past messages", err);
      }
    })();
  }, [campaignId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
 
    setIsLoading(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    console.log("User message:", userMessage);
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          campaignId,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch response");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("ReadableStream not supported");

      const decoder = new TextDecoder();
      let done = false;
      let assistantMessageId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: "assistant", content: "", timestamp: new Date().toISOString() },
      ]);

      let assistantMessageContent = "";
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          let chunk = decoder.decode(value, { stream: true });

          // Safely parse and decode any escaped characters
          try {
            chunk = JSON.parse(`"${chunk.replace(/"/g, '\"')}"`);
          } catch (e) {
            // fallback: replace \\n with <br /> manually
            chunk = chunk.replace(/\\n/g, "<br />").replace(/\n/g, "<br />");
          }

          assistantMessageContent += chunk;

          setMessages((prev) => {
            const messagesCopy = [...prev];
            const lastIndex = messagesCopy.findIndex(
              (m) => m.id === assistantMessageId
            );
            if (lastIndex !== -1) {
              messagesCopy[lastIndex] = {
                ...messagesCopy[lastIndex],
                content: messagesCopy[lastIndex].content + chunk,
              };
            }
            return messagesCopy;
          });
        }
      }
      // After assistant message is fully received, save it to backend
      const assistantMsg = {
        id: assistantMessageId,
        role: "assistant",
        content: assistantMessageContent,
        timestamp: new Date().toISOString(),
      };
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          messages: [assistantMsg],
        }),
      });
    } catch (err) {
      console.error("Error during fetch:", err);
    }

    setIsLoading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handlePrompt = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => {
      handleSubmit(new Event("submit") as any);
    }, 0);
  };

  const noMessages = messages.length === 0;
  if (!campaignId) {
    return (
      <main className="centered-card">
        <div className="card">
          <Settings />
          <Logo name="tarot" />
          <h1>Wyvern Storyteller</h1>
          <InformationPopUp message="Welcome to Wyvern Storyteller! Please select or create a campaign to start chatting with your AI Game Master. It is still a work in progress and you may need to let your AI GM know information pertaining to your character. :)" />
          <p className="subtitle">Choose or create a campaign to begin</p>
          <CampaignManager onSelect={(id) => setCampaignId(id)} />
        </div>
      </main>
    );
  }
  else{
  return (
    <main className="centered-card">
      <div className="card">
        <Settings />
        <button
          className="back-button button secondary"
          style={{ alignSelf: 'flex-start', marginBottom: 12 }}
          onClick={() => setCampaignId(null)}
        >
          ← Back to Campaigns
        </button>
        <Logo name="tarot" />
        <h1>Wyvern Storyteller</h1>
        <p className="campaign-name">📜 Current Campaign: <strong>{campaignId ? campaignId : "None" }</strong></p>
        <div id="campaign-info">
          <section className={noMessages ? "" : "populated"}>
            {noMessages ? (
              <>
                <p className="starter-text"> Welcome to Wyvern DM </p>
                <br />
                <PromptSuggestions onPromptClick={handlePrompt} />
              </>
            ) : (
              <>
                {messages.map((message, index) => (
                  <Bubble
                    key={`message-${index}`}
                    message={{ ...message, content: message.content.replace(/\n/g, "\n") }}
                    timestamp={message.timestamp}
                  />
                ))}
                {isLoading && <LoadingBubble />}
              </>
            )}
            <form onSubmit={handleSubmit}>
              <input
                className="question-box"
                onChange={handleInputChange}
                value={input}
                placeholder="Enter message here"
              />
              <input type="submit" />
            </form>
          </section>
        </div>
      </div>
    </main>
    );
  }
};


export default Home;
