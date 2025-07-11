"use client";

import React from "react";
import DOMPurify from "dompurify";
import { Message } from "ai";

interface BubbleProps {
  message: Message;
}

const cleanContent = (text: string): string => {
  if (!text) return "";

  // Replace escaped newlines with <br />
  let cleaned = text
    .replace(/\\n/g, "<br />")   // handle escaped \n
    .replace(/\n/g, "<br />")    // handle real newlines
    .replace(/\\(.)/g, "$1");    // remove other escaped chars like \" or \'

  return cleaned;
};

const Bubble: React.FC<BubbleProps> = ({ message }) => {
  return (
    <div className={`bubble ${message.role}`}>
      <div
        className="message-content"
        // Sanitize to avoid XSS attacks
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(cleanContent(message.content)),
        }}
      />
    </div>
  );
};

export default Bubble;
