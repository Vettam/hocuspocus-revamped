import test from "ava";
import { tiptapJsonToMarkdown } from "../converters/tiptap-to-json";

// Basic node types
test("tiptapJsonToMarkdown converts simple paragraph", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Hello World" }],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "Hello World\n\n");
});

test("tiptapJsonToMarkdown converts heading level 1", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Main Title" }],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "# Main Title\n\n");
});

test("tiptapJsonToMarkdown converts heading level 3", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "Subsection" }],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "### Subsection\n\n");
});

test("tiptapJsonToMarkdown converts code block with language", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "codeBlock",
        attrs: { language: "javascript" },
        content: [{ type: "text", text: "const x = 1;" }],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "```javascript\nconst x = 1;\n```\n\n");
});

test("tiptapJsonToMarkdown converts code block without language", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "codeBlock",
        content: [{ type: "text", text: "plain code" }],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "```\nplain code\n```\n\n");
});

// Text formatting (marks)
test("tiptapJsonToMarkdown converts bold text", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "This is " },
          { type: "text", marks: [{ type: "bold" }], text: "bold" },
          { type: "text", text: " text" },
        ],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "This is **bold** text\n\n");
});

test("tiptapJsonToMarkdown converts italic text", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "This is " },
          { type: "text", marks: [{ type: "italic" }], text: "italic" },
          { type: "text", text: " text" },
        ],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "This is *italic* text\n\n");
});

test("tiptapJsonToMarkdown converts bold and italic text", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "This is " },
          {
            type: "text",
            marks: [{ type: "bold" }, { type: "italic" }],
            text: "bold italic",
          },
        ],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "This is ***bold italic***\n\n");
});

test("tiptapJsonToMarkdown converts code mark", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Inline " },
          { type: "text", marks: [{ type: "code" }], text: "code" },
          { type: "text", text: " here" },
        ],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "Inline `code` here\n\n");
});

test("tiptapJsonToMarkdown converts strikethrough", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", marks: [{ type: "strike" }], text: "deleted text" },
        ],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "~~deleted text~~\n\n");
});

test("tiptapJsonToMarkdown converts underline", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", marks: [{ type: "underline" }], text: "underlined" },
        ],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "<u>underlined</u>\n\n");
});

test("tiptapJsonToMarkdown converts link", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Visit " },
          {
            type: "text",
            marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            text: "Example",
          },
        ],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "Visit [Example](https://example.com)\n\n");
});

// Lists
test("tiptapJsonToMarkdown converts bullet list", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "First item" }],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Second item" }],
              },
            ],
          },
        ],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "- First item\n- Second item\n\n");
});

test("tiptapJsonToMarkdown converts ordered list", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "orderedList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "First" }],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Second" }],
              },
            ],
          },
        ],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "1. First\n2. Second\n\n");
});

// Edge cases
test("tiptapJsonToMarkdown handles empty document", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "");
});

test("tiptapJsonToMarkdown handles null input", (t) => {
  const result = tiptapJsonToMarkdown(null);
  t.is(result, "");
});

test("tiptapJsonToMarkdown handles undefined input", (t) => {
  const result = tiptapJsonToMarkdown(undefined);
  t.is(result, "");
});

test("tiptapJsonToMarkdown handles document without content property", (t) => {
  const tiptapJson = {
    type: "doc",
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "");
});

test("tiptapJsonToMarkdown handles empty paragraph", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "\n");
});

test("tiptapJsonToMarkdown handles text node without text property", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text" }],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, "\n");
});

// Complex documents
test("tiptapJsonToMarkdown converts complex document", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Title" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "This is a paragraph with " },
          { type: "text", marks: [{ type: "bold" }], text: "bold" },
          { type: "text", text: " and " },
          { type: "text", marks: [{ type: "italic" }], text: "italic" },
          { type: "text", text: " text." },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "List item" }],
              },
            ],
          },
        ],
      },
    ],
  };

  const result = tiptapJsonToMarkdown(tiptapJson);
  const expected =
    "# Title\n\nThis is a paragraph with **bold** and *italic* text.\n\n- List item\n\n";
  t.is(result, expected);
});

test("tiptapJsonToMarkdown preserves newlines in code blocks", (t) => {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "codeBlock",
        attrs: { language: "python" },
        content: [{ type: "text", text: 'def hello():\n    print("Hi")\n' }],
      },
    ],
  };
  const result = tiptapJsonToMarkdown(tiptapJson);
  t.is(result, '```python\ndef hello():\n    print("Hi")\n```\n\n');
});
