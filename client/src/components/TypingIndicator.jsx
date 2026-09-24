export default function TypingIndicator() {
  return (
    <div className="chat-message assistant typing" aria-label="Assistant is typing">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  );
}
