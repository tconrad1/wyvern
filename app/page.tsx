"use client";

import Image from "next/image";
import Logo  from "./components/Logo";
import { Message } from "ai";
import Bubble from "./components/Bubble";
import LoadingBubble from "./components/loading";
import PromptSuggestions from "./components/PromptSuggestions";
import { useState } from "react";
import CampaignManager from "./components/CampaignManager"
import  InformationPopUp  from "./components/InformationPopUp";

const Home = () => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  const model_to_use = "gemini";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
 
    setIsLoading(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
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
          model: model_to_use,
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
        { id: assistantMessageId, role: "assistant", content: "" },
      ]);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          let chunk = decoder.decode(value, { stream: true });

          // Safely parse and decode any escaped characters
          try {
            chunk = JSON.parse(`"${chunk.replace(/"/g, '\\"')}"`);
          } catch (e) {
            // fallback: replace \n with <br /> manually
            chunk = chunk.replace(/\\n/g, "<br />").replace(/\n/g, "<br />");
          }

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
     if(!campaignId) {
          return (
            <main>
              {Logo("tarot")}
              <h1>Wyvern Storyteller</h1>
              <InformationPopUp message="Welcome to Wyvern Storyteller! Please select or create a campaign to start chatting with your AI Game Master. It is still a work in progress and you may need to let your AI GM know information pertaining to your character. :)" />


              <p className="subtitle">Choose or create a campaign to begin</p>
              <CampaignManager onSelect={(id) => setCampaignId(id)} />

            </main>
          );
        }

    return (
      
       
        

        
        <main>

        {Logo("tarot")}
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
              />
            ))}
            {isLoading && <LoadingBubble />}
          </>
        )}
      </section>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          className="question-box"
          onChange={handleInputChange}
          value={input}
          placeholder="Enter message here"
        />

        
        <input type="submit" />
      </form>
    </main>
  );
};


export default Home;
