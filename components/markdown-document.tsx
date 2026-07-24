import type { ReactNode } from "react";

function inlineMarkdown(value: string, key: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g).map((part, index) => {
    const partKey = `${key}-${index}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={partKey}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={partKey}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("_") && part.endsWith("_")) {
      return <em key={partKey}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function tableCells(value: string) {
  return value
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(value: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(
    value,
  );
}

export function MarkdownDocument({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={`code-${index}`} data-language={language || undefined}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const content = inlineMarkdown(heading[2], `heading-${index}`);
      if (level === 1) blocks.push(<h1 key={`heading-${index}`}>{content}</h1>);
      if (level === 2) blocks.push(<h2 key={`heading-${index}`}>{content}</h2>);
      if (level === 3) blocks.push(<h3 key={`heading-${index}`}>{content}</h3>);
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push(<hr key={`rule-${index}`} />);
      index += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      blocks.push(
        <blockquote key={`quote-${index}`}>
          {inlineMarkdown(line.slice(2), `quote-${index}`)}
        </blockquote>,
      );
      index += 1;
      continue;
    }

    if (lines[index + 1] && line.includes("|") && isTableDivider(lines[index + 1])) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|")) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push(
        <div className="markdown-table-wrap" key={`table-${index}`}>
          <table>
            <thead>
              <tr>
                {headers.map((header, cellIndex) => (
                  <th key={`${header}-${cellIndex}`}>
                    {inlineMarkdown(header, `header-${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {headers.map((_, cellIndex) => (
                    <td key={`cell-${rowIndex}-${cellIndex}`}>
                      {inlineMarkdown(
                        row[cellIndex] ?? "",
                        `cell-${rowIndex}-${cellIndex}`,
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const listMatch = /^(?:[-*+]\s+|\d+\.\s+)/.exec(line);
    if (listMatch) {
      const ordered = /^\d+\.\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].trim();
        const pattern = ordered ? /^\d+\.\s+(.+)$/ : /^[-*+]\s+(.+)$/;
        const match = pattern.exec(item);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      const listItems = items.map((item, itemIndex) => (
        <li key={`item-${itemIndex}`}>
          {inlineMarkdown(item, `item-${itemIndex}`)}
        </li>
      ));
      blocks.push(
        ordered ? <ol key={`list-${index}`}>{listItems}</ol> : <ul key={`list-${index}`}>{listItems}</ul>,
      );
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      const next = lines[index].trim();
      if (
        /^(#{1,3})\s+/.test(next) ||
        next.startsWith("```") ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(next) ||
        /^(?:[-*+]\s+|\d+\.\s+)/.test(next)
      ) {
        break;
      }
      paragraph.push(next);
      index += 1;
    }
    blocks.push(
      <p key={`paragraph-${index}`}>
        {inlineMarkdown(paragraph.join(" "), `paragraph-${index}`)}
      </p>,
    );
  }

  return <article className="markdown-document">{blocks}</article>;
}
