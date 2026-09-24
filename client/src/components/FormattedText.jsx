function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
      : <span key={`${keyPrefix}-${i}`}>{part}</span>
  );
}

// Renders plain text with markdown-style bullet lines ("- " / "* ") as real
// list items and **bold** as <strong>, instead of the browser collapsing all
// of it into one run-on paragraph (the default for a plain text node).
export default function FormattedText({ text }) {
  const lines = text.split('\n');
  const blocks = [];
  let currentList = null;

  lines.forEach((line) => {
    const trimmed = line.trim();
    const isBullet = /^[-*]\s+/.test(trimmed);
    if (isBullet) {
      if (!currentList) {
        currentList = [];
        blocks.push({ type: 'list', items: currentList });
      }
      currentList.push(trimmed.replace(/^[-*]\s+/, ''));
    } else {
      currentList = null;
      if (trimmed) blocks.push({ type: 'p', text: trimmed });
    }
  });

  return (
    <>
      {blocks.map((block, i) =>
        block.type === 'list' ? (
          <ul className="msg-list" key={i}>
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item, `${i}-${j}`)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{renderInline(block.text, `${i}`)}</p>
        )
      )}
    </>
  );
}
