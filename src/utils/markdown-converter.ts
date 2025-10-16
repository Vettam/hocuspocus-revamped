import MarkdownIt from "markdown-it";

/**
 * Remove HTML-style comments from markdown content
 * Skips anything between <!-- and -->
 */
export function removeHtmlComments(content: string): string {
  // Use regex to match <!-- ... --> comments, including multiline
  return content.replace(/<!--[\s\S]*?-->/g, "");
}

/**
 * Convert markdown content to TipTap-compatible JSON structure
 */
export function markdownToTiptapJson(markdownContent: string) {
  // Remove HTML comments before processing
  const cleanedContent = removeHtmlComments(markdownContent);

  const md = new MarkdownIt();
  const tokens = md.parse(cleanedContent, {});

  const content: any[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === "heading_open") {
      const level = parseInt(token.tag.substring(1)); // h1 -> 1, h2 -> 2, etc.
      const nextToken = tokens[i + 1];
      if (nextToken && nextToken.type === "inline") {
        const headingContent = parseInlineContent(nextToken.content);
        content.push({
          type: "heading",
          attrs: { level },
          content: headingContent,
        });
        i++; // Skip the inline token as we've processed it
      }
    } else if (token.type === "paragraph_open") {
      const nextToken = tokens[i + 1];
      if (nextToken && nextToken.type === "inline") {
        const paragraphContent = parseInlineContent(nextToken.content);
        content.push({
          type: "paragraph",
          content: paragraphContent,
        });
        i++; // Skip the inline token
      }
    } else if (token.type === "code_block") {
      content.push({
        type: "codeBlock",
        content: [{ type: "text", text: token.content }],
      });
    } else if (token.type === "fence") {
      content.push({
        type: "codeBlock",
        attrs: { language: token.info || null },
        content: [{ type: "text", text: token.content }],
      });
    } else if (token.type === "bullet_list_open") {
      const listItems = parseListItems(tokens, i);
      content.push({
        type: "bulletList",
        content: listItems.items,
      });
      i = listItems.endIndex;
    } else if (token.type === "ordered_list_open") {
      const listItems = parseListItems(tokens, i);
      content.push({
        type: "orderedList",
        content: listItems.items,
      });
      i = listItems.endIndex;
    }
  }

  return {
    type: "doc",
    content:
      content.length > 0 ? content : [{ type: "paragraph", content: [] }],
  };
}

/**
 * Parse inline content for text formatting (links, bold, italic, code)
 */
export function parseInlineContent(content: string): any[] {
  if (!content.trim()) {
    return [];
  }

  let workingContent = content;
  const result: any[] = [];

  // Process patterns in order of specificity (most specific first)
  const patterns = [
    { regex: /\[([^\]]+)\]\(([^)]+)\)/, type: "link" }, // [text](url)
    { regex: /\*\*\*([^*\n]+?)\*\*\*/, type: "bold-italic" }, // ***text***
    { regex: /___([^_\n]+?)___/, type: "bold-italic" }, // ___text___
    { regex: /\*\*_([^*_\n]+?)_\*\*/, type: "bold-italic" }, // **_text_**
    { regex: /_\*\*([^*_\n]+?)\*\*_/, type: "bold-italic" }, // _**text**_
    { regex: /~~([^~\n]+?)~~/, type: "strikethrough" }, // ~~text~~
    { regex: /<u>([^<\n]+?)<\/u>/, type: "underline" }, // <u>text</u>
    { regex: /\*\*([^*\n]+?)\*\*/, type: "bold" }, // **text**
    { regex: /__([^_\n]+?)__/, type: "bold" }, // __text__
    { regex: /`([^`\n]+?)`/, type: "code" }, // `code`
  ];

  // Process each pattern
  while (workingContent.length > 0) {
    let foundMatch = false;
    let earliestMatch = {
      index: Infinity,
      length: 0,
      type: "",
      text: "",
      url: "",
      fullMatch: "",
    };

    // Find the earliest match among all patterns
    patterns.forEach((pattern) => {
      const match = workingContent.match(pattern.regex);
      if (
        match &&
        match.index !== undefined &&
        match.index < earliestMatch.index
      ) {
        earliestMatch = {
          index: match.index,
          length: match[0].length,
          type: pattern.type,
          text: match[1],
          url: pattern.type === "link" ? match[2] : "",
          fullMatch: match[0],
        };
      }
    });

    if (earliestMatch.index !== Infinity) {
      foundMatch = true;

      // Add any plain text before the match
      if (earliestMatch.index > 0) {
        const plainText = workingContent.substring(0, earliestMatch.index);
        result.push({ type: "text", text: plainText });
      }

      // Add the formatted element
      switch (earliestMatch.type) {
        case "link":
          result.push({
            type: "text",
            marks: [
              {
                type: "link",
                attrs: { href: earliestMatch.url, target: "_blank" },
              },
            ],
            text: earliestMatch.text,
          });
          break;
        case "bold-italic":
          result.push({
            type: "text",
            marks: [{ type: "bold" }, { type: "italic" }],
            text: earliestMatch.text,
          });
          break;
        case "bold":
          result.push({
            type: "text",
            marks: [{ type: "bold" }],
            text: earliestMatch.text,
          });
          break;
        case "italic":
          result.push({
            type: "text",
            marks: [{ type: "italic" }],
            text: earliestMatch.text,
          });
          break;
        case "strikethrough":
          result.push({
            type: "text",
            marks: [{ type: "strike" }],
            text: earliestMatch.text,
          });
          break;
        case "underline":
          result.push({
            type: "text",
            marks: [{ type: "underline" }],
            text: earliestMatch.text,
          });
          break;
        case "code":
          result.push({
            type: "text",
            marks: [{ type: "code" }],
            text: earliestMatch.text,
          });
          break;
      }

      // Remove the processed part from working content
      workingContent = workingContent.substring(
        earliestMatch.index + earliestMatch.length
      );
    }

    // Handle italic patterns separately to avoid conflicts with bold
    if (!foundMatch) {
      // Check for single * or _ patterns (italic)
      const italicStarMatch = workingContent.match(/\*([^*\n]+?)\*/);
      const italicUnderMatch = workingContent.match(/_([^_\n]+?)_/);

      let italicMatch = null;
      if (
        italicStarMatch &&
        (!italicUnderMatch || italicStarMatch.index! < italicUnderMatch.index!)
      ) {
        italicMatch = { match: italicStarMatch, type: "italic" };
      } else if (italicUnderMatch) {
        italicMatch = { match: italicUnderMatch, type: "italic" };
      }

      if (italicMatch && italicMatch.match.index !== undefined) {
        foundMatch = true;

        // Add plain text before match
        if (italicMatch.match.index > 0) {
          const plainText = workingContent.substring(
            0,
            italicMatch.match.index
          );
          result.push({ type: "text", text: plainText });
        }

        // Add italic text
        result.push({
          type: "text",
          marks: [{ type: "italic" }],
          text: italicMatch.match[1],
        });

        // Remove processed part
        workingContent = workingContent.substring(
          italicMatch.match.index + italicMatch.match[0].length
        );
      }
    }

    // If no match found, add remaining text and break
    if (!foundMatch) {
      if (workingContent.trim()) {
        result.push({ type: "text", text: workingContent });
      }
      break;
    }
  }

  // Return result or plain text if no formatting found
  return result.length > 0 ? result : [{ type: "text", text: content }];
}

/**
 * Parse list items from tokens (supports nested lists)
 */
export function parseListItems(
  tokens: any[],
  startIndex: number
): { items: any[]; endIndex: number } {
  const items: any[] = [];
  let i = startIndex + 1; // Skip the list_open token

  while (
    i < tokens.length &&
    tokens[i].type !== "bullet_list_close" &&
    tokens[i].type !== "ordered_list_close"
  ) {
    if (tokens[i].type === "list_item_open") {
      const listItemContent: any[] = [];
      i++; // Move past list_item_open

      // Parse all content within this list item
      while (i < tokens.length && tokens[i].type !== "list_item_close") {
        if (tokens[i].type === "paragraph_open") {
          const inlineToken = tokens[i + 1];
          if (inlineToken && inlineToken.type === "inline") {
            listItemContent.push({
              type: "paragraph",
              content: parseInlineContent(inlineToken.content),
            });
            i += 2; // Skip paragraph_open and inline tokens
          }
        } else if (tokens[i].type === "bullet_list_open") {
          // Handle nested bullet list
          const nestedList = parseListItems(tokens, i);
          listItemContent.push({
            type: "bulletList",
            content: nestedList.items,
          });
          i = nestedList.endIndex;
        } else if (tokens[i].type === "ordered_list_open") {
          // Handle nested ordered list
          const nestedList = parseListItems(tokens, i);
          listItemContent.push({
            type: "orderedList",
            content: nestedList.items,
          });
          i = nestedList.endIndex;
        } else {
          i++; // Move to next token
        }
      }

      // Add the list item with all its content
      items.push({
        type: "listItem",
        content:
          listItemContent.length > 0
            ? listItemContent
            : [{ type: "paragraph", content: [] }],
      });
    } else {
      i++; // Move to next token
    }
  }

  return { items, endIndex: i };
}
