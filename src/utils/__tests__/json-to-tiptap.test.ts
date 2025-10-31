import test from "ava";
import {
  markdownToTiptapJson,
  removeHtmlComments,
  parseInlineContent,
} from "../converters/json-to-tiptap";

// removeHtmlComments tests
test("removeHtmlComments removes single-line HTML comments", (t) => {
  const input = "Hello <!-- comment --> World";
  const result = removeHtmlComments(input);
  t.is(result, "Hello  World");
});

test("removeHtmlComments removes multi-line HTML comments", (t) => {
  const input = "Hello <!-- multi\nline\ncomment --> World";
  const result = removeHtmlComments(input);
  t.is(result, "Hello  World");
});

test("removeHtmlComments removes multiple HTML comments", (t) => {
  const input = "A <!-- c1 --> B <!-- c2 --> C";
  const result = removeHtmlComments(input);
  t.is(result, "A  B  C");
});

test("removeHtmlComments handles text without comments", (t) => {
  const input = "No comments here";
  const result = removeHtmlComments(input);
  t.is(result, "No comments here");
});

// parseInlineContent tests
test("parseInlineContent parses plain text", (t) => {
  const result = parseInlineContent("Hello World");
  t.deepEqual(result, [{ type: "text", text: "Hello World" }]);
});

test("parseInlineContent parses bold text with **", (t) => {
  const result = parseInlineContent("This is **bold** text");
  t.deepEqual(result, [
    { type: "text", text: "This is " },
    { type: "text", marks: [{ type: "bold" }], text: "bold" },
    { type: "text", text: " text" },
  ]);
});

test("parseInlineContent parses italic text with *", (t) => {
  const result = parseInlineContent("This is *italic* text");
  t.deepEqual(result, [
    { type: "text", text: "This is " },
    { type: "text", marks: [{ type: "italic" }], text: "italic" },
    { type: "text", text: " text" },
  ]);
});

test("parseInlineContent parses bold and italic with ***", (t) => {
  const result = parseInlineContent("This is ***bold italic*** text");
  t.deepEqual(result, [
    { type: "text", text: "This is " },
    {
      type: "text",
      marks: [{ type: "bold" }, { type: "italic" }],
      text: "bold italic",
    },
    { type: "text", text: " text" },
  ]);
});

test("parseInlineContent parses code with backticks", (t) => {
  const result = parseInlineContent("This is `code` text");
  t.deepEqual(result, [
    { type: "text", text: "This is " },
    { type: "text", marks: [{ type: "code" }], text: "code" },
    { type: "text", text: " text" },
  ]);
});

test("parseInlineContent parses strikethrough with ~~", (t) => {
  const result = parseInlineContent("This is ~~strikethrough~~ text");
  t.deepEqual(result, [
    { type: "text", text: "This is " },
    { type: "text", marks: [{ type: "strike" }], text: "strikethrough" },
    { type: "text", text: " text" },
  ]);
});

test("parseInlineContent parses underline with <u> tags", (t) => {
  const result = parseInlineContent("This is <u>underlined</u> text");
  t.deepEqual(result, [
    { type: "text", text: "This is " },
    { type: "text", marks: [{ type: "underline" }], text: "underlined" },
    { type: "text", text: " text" },
  ]);
});

test("parseInlineContent parses links", (t) => {
  const result = parseInlineContent("Visit [Google](https://google.com) now");
  t.deepEqual(result, [
    { type: "text", text: "Visit " },
    {
      type: "text",
      marks: [
        {
          type: "link",
          attrs: { href: "https://google.com", target: "_blank" },
        },
      ],
      text: "Google",
    },
    { type: "text", text: " now" },
  ]);
});

test("parseInlineContent handles empty string", (t) => {
  const result = parseInlineContent("");
  t.deepEqual(result, []);
});

test("parseInlineContent handles whitespace only", (t) => {
  const result = parseInlineContent("   ");
  t.deepEqual(result, []);
});

// markdownToTiptapJson tests
test("markdownToTiptapJson converts heading level 1", (t) => {
  const result = markdownToTiptapJson("# Heading 1");
  t.deepEqual(result, {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Heading 1" }],
      },
    ],
  });
});

test("markdownToTiptapJson converts heading level 2", (t) => {
  const result = markdownToTiptapJson("## Heading 2");
  t.deepEqual(result, {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Heading 2" }],
      },
    ],
  });
});

test("markdownToTiptapJson converts paragraph", (t) => {
  const result = markdownToTiptapJson("This is a paragraph.");
  t.deepEqual(result, {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "This is a paragraph." }],
      },
    ],
  });
});

test("markdownToTiptapJson converts code block with language", (t) => {
  const result = markdownToTiptapJson("```javascript\nconst x = 1;\n```");
  t.deepEqual(result, {
    type: "doc",
    content: [
      {
        type: "codeBlock",
        attrs: { language: "javascript" },
        content: [{ type: "text", text: "const x = 1;\n" }],
      },
    ],
  });
});

test("markdownToTiptapJson converts code block without language", (t) => {
  const result = markdownToTiptapJson("```\nconst x = 1;\n```");
  t.deepEqual(result, {
    type: "doc",
    content: [
      {
        type: "codeBlock",
        attrs: { language: null },
        content: [{ type: "text", text: "const x = 1;\n" }],
      },
    ],
  });
});

test("markdownToTiptapJson converts bullet list", (t) => {
  const result = markdownToTiptapJson("- Item 1\n- Item 2");
  t.deepEqual(result, {
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
                content: [{ type: "text", text: "Item 1" }],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Item 2" }],
              },
            ],
          },
        ],
      },
    ],
  });
});

test("markdownToTiptapJson converts ordered list", (t) => {
  const result = markdownToTiptapJson("1. First\n2. Second");
  t.deepEqual(result, {
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
  });
});

test("markdownToTiptapJson returns empty paragraph for empty input", (t) => {
  const result = markdownToTiptapJson("");
  t.deepEqual(result, {
    type: "doc",
    content: [{ type: "paragraph", content: [] }],
  });
});

test("markdownToTiptapJson removes HTML comments before processing", (t) => {
  const result = markdownToTiptapJson("Hello <!-- comment --> World");
  t.deepEqual(result, {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Hello  World" }],
      },
    ],
  });
});

test("markdownToTiptapJson converts complex markdown with multiple elements", (t) => {
  const markdown = `# Title

This is a paragraph with **bold** and *italic* text.

- List item 1
- List item 2`;

  const result = markdownToTiptapJson(markdown);

  t.is(result.type, "doc");
  t.is(result.content.length, 3); // heading, paragraph, list
  t.is(result.content[0].type, "heading");
  t.is(result.content[1].type, "paragraph");
  t.is(result.content[2].type, "bulletList");
});
