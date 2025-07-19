"use client";

import React from "react";
import DOMPurify from "dompurify";

interface BubbleProps {
  message: { id: string; role: string; content: string; timestamp?: string };
  timestamp?: string;
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

const Bubble: React.FC<BubbleProps> = ({ message, timestamp }) => {
  return (
    <div className={`bubble bubble-${message.role}`}>
      <div
        className="message-content"
        // Sanitize to avoid XSS attacks
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(cleanContent(message.content)),
        }}
      />
      {timestamp && (
        <div style={{ fontSize: '0.75em', color: '#888', marginTop: 4, textAlign: 'right' }}>
          {new Date(timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default Bubble;
