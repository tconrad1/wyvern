export function ChatResponse({ text }: { text: string }) {
  return (
    <div style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
      {text}
    </div>
  );
}
