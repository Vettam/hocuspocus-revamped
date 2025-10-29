export function tiptapJsonToMarkdown(tiptapJson: any): string {
  if (!tiptapJson || !tiptapJson.content) {
    return "";
  }

  return processContent(tiptapJson.content);
}

/**
 * Process an array of content nodes and convert them to markdown
 */
function processContent(content: any[]): string {
  if (!Array.isArray(content)) {
    return "";
  }

  return content.map((node) => processNode(node)).join("");
}

/**
 * Process a single node and convert it to markdown
 */
function processNode(node: any): string {
  if (!node || !node.type) {
    return "";
  }

  switch (node.type) {
    case "doc":
      return processContent(node.content || []);

    case "paragraph":
      const paragraphContent = processContent(node.content || []);
      return paragraphContent.trim() ? `${paragraphContent}\n\n` : "\n";

    case "heading":
      const level = node.attrs?.level || 1;
      const headingContent = processContent(node.content || []);
      return `${"#".repeat(level)} ${headingContent}\n\n`;

    case "codeBlock":
      const language = node.attrs?.language || "";
      const codeContent = processContent(node.content || []);
      return `\`\`\`${language}\n${codeContent.trimEnd()}\n\`\`\`\n\n`;

    case "bulletList":
      return processListItems(node.content || [], "bullet", 0);

    case "orderedList":
      return processListItems(node.content || [], "ordered", 0);

    case "listItem":
      return processContent(node.content || []);

    case "text":
      return processTextNode(node);

    default:
      // For unknown node types, try to process their content
      return processContent(node.content || []);
  }
}

/**
 * Process list items with proper indentation
 */
function processListItems(
  items: any[],
  listType: "bullet" | "ordered",
  depth: number
): string {
  if (!Array.isArray(items)) {
    return "";
  }

  const indent = "  ".repeat(depth);
  let result = "";

  items.forEach((item, index) => {
    if (item.type === "listItem") {
      const content = item.content || [];
      let itemContent = "";

      content.forEach((contentNode: any) => {
        if (contentNode.type === "paragraph") {
          const paragraphText = processContent(
            contentNode.content || []
          ).trim();
          if (paragraphText) {
            itemContent += paragraphText;
          }
        } else if (contentNode.type === "bulletList") {
          itemContent +=
            "\n" +
            processListItems(contentNode.content || [], "bullet", depth + 1);
        } else if (contentNode.type === "orderedList") {
          itemContent +=
            "\n" +
            processListItems(contentNode.content || [], "ordered", depth + 1);
        } else {
          itemContent += processNode(contentNode);
        }
      });

      const marker = listType === "bullet" ? "-" : `${index + 1}.`;
      result += `${indent}${marker} ${itemContent}\n`;
    }
  });

  return result + (depth === 0 ? "\n" : "");
}

/**
 * Process a text node with its marks (formatting)
 */
function processTextNode(node: any): string {
  if (!node.text) {
    return "";
  }

  let text = node.text;
  const marks = node.marks || [];

  // Apply marks in the correct order
  let isBold = false;
  let isItalic = false;
  let isCode = false;
  let isStrike = false;
  let isUnderline = false;
  let linkAttrs: any = null;

  marks.forEach((mark: any) => {
    switch (mark.type) {
      case "bold":
        isBold = true;
        break;
      case "italic":
        isItalic = true;
        break;
      case "code":
        isCode = true;
        break;
      case "strike":
        isStrike = true;
        break;
      case "underline":
        isUnderline = true;
        break;
      case "link":
        linkAttrs = mark.attrs;
        break;
    }
  });

  // Apply formatting in reverse order of parsing precedence
  if (isCode) {
    text = `\`${text}\``;
  } else {
    if (isBold && isItalic) {
      text = `***${text}***`;
    } else if (isBold) {
      text = `**${text}**`;
    } else if (isItalic) {
      text = `*${text}*`;
    }

    if (isStrike) {
      text = `~~${text}~~`;
    }

    if (isUnderline) {
      text = `<u>${text}</u>`;
    }
  }

  if (linkAttrs && linkAttrs.href) {
    // Extract the original text without formatting for the link text
    const linkText = node.text;
    text = `[${linkText}](${linkAttrs.href})`;
  }

  return text;
}
