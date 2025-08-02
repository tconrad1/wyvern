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

// Utility to extract plain text from a markdown/code block response
function extractPlainTextFromResponse(response: string): string {
  // Remove code blocks (```...```), JSON, and trim
  const codeBlockRegex = /```[\s\S]*?```/g;
  let text = response.replace(codeBlockRegex, '').trim();
  // Optionally, remove leading/trailing newlines and whitespace
  return text;
}

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
      // Get model and provider from settings
      const model = localStorage.getItem('model') || '';
      const providerType = localStorage.getItem('providerType') || 'ollama';
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          campaignId,
          modelName: model || undefined,
          providerType: providerType as 'ollama' | 'openrouter',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        throw new Error(`Failed to fetch response: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        // Non-streaming fallback: parse JSON and use only the 'text' property
        const responseJson = await response.json();
        const assistantText = typeof responseJson.text === 'string' ? responseJson.text : '';
        const assistantMessageId = crypto.randomUUID();
        setMessages((prev) => [
          ...prev,
          { id: assistantMessageId, role: "assistant", content: assistantText, timestamp: new Date().toISOString() },
        ]);
        // Save to backend
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId,
            messages: [{
              id: assistantMessageId,
              role: "assistant",
              content: assistantText,
              timestamp: new Date().toISOString(),
            }],
          }),
        });
        setIsLoading(false);
        return;
      }

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
          let chunk = new TextDecoder().decode(value, { stream: true });

          // Try to extract only the 'text' property if the chunk is a JSON object
          let parsedChunk = chunk;
          try {
            const maybeJson = JSON.parse(chunk);
            if (maybeJson && typeof maybeJson.text === 'string') {
              parsedChunk = maybeJson.text;
            }
          } catch (e) {
            // Not JSON, use as is
          }

          assistantMessageContent += parsedChunk;

          setMessages((prev) => {
            const messagesCopy = [...prev];
            const lastIndex = messagesCopy.findIndex(
              (m) => m.id === assistantMessageId
            );
            if (lastIndex !== -1) {
              messagesCopy[lastIndex] = {
                ...messagesCopy[lastIndex],
                content: messagesCopy[lastIndex].content + parsedChunk,
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
        content: extractPlainTextFromResponse(assistantMessageContent),
        timestamp: new Date().toISOString(),
      };
      const savedProviderType = localStorage.getItem('providerType') || 'ollama';
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          messages: [assistantMsg],
          providerType: savedProviderType as 'ollama' | 'openrouter',
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
