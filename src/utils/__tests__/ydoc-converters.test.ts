import test from "ava";
import * as Y from "yjs";
import { yDocToJSON, jsonToYDoc } from "../ydoc/converters";
import { schema } from "../ydoc/schema";

// Helper to create a TipTap JSON document
function createTiptapDoc(content: any[] = []): any {
  return {
    type: "doc",
    content,
  };
}

// Helper to create a paragraph node
function createParagraph(text: string): any {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

// Helper to create a heading node
function createHeading(level: number, text: string): any {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

// yDocToJSON tests
test("yDocToJSON returns empty doc for new Y.Doc", (t) => {
  const ydoc = new Y.Doc();

  const result = yDocToJSON(ydoc, schema, "shared");
  const parsed = JSON.parse(result);

  t.is(parsed.type, "doc");
  t.deepEqual(parsed.content, []);
});

test("yDocToJSON returns empty doc when fragment is empty", (t) => {
  const ydoc = new Y.Doc();
  // Access fragment to create it, but don't add content
  ydoc.getXmlFragment("shared");

  const result = yDocToJSON(ydoc, schema, "shared");
  const parsed = JSON.parse(result);

  t.is(parsed.type, "doc");
  t.deepEqual(parsed.content, []);
});

test("yDocToJSON uses custom field name", (t) => {
  const ydoc = new Y.Doc();

  const result = yDocToJSON(ydoc, schema, "custom-field");
  const parsed = JSON.parse(result);

  t.is(parsed.type, "doc");
  t.deepEqual(parsed.content, []);
});

test("yDocToJSON uses default field name when not specified", (t) => {
  const ydoc = new Y.Doc();

  const result = yDocToJSON(ydoc, schema);
  const parsed = JSON.parse(result);

  t.is(parsed.type, "doc");
  t.truthy(parsed.content !== undefined);
});

// jsonToYDoc tests
test("jsonToYDoc converts empty document", (t) => {
  const ydoc = new Y.Doc();
  const tiptapDoc = createTiptapDoc([]);

  t.notThrows(() => {
    jsonToYDoc(tiptapDoc, ydoc, schema);
  });

  const fragment = ydoc.getXmlFragment("default");
  t.is(fragment.length, 0);
});

test("jsonToYDoc converts document with paragraph", (t) => {
  const ydoc = new Y.Doc();
  const tiptapDoc = createTiptapDoc([createParagraph("Hello World")]);

  t.notThrows(() => {
    jsonToYDoc(tiptapDoc, ydoc, schema, "default");
  });

  const fragment = ydoc.getXmlFragment("default");
  t.true(fragment.length > 0);
});

test("jsonToYDoc accepts JSON string", (t) => {
  const ydoc = new Y.Doc();
  const tiptapDoc = createTiptapDoc([createParagraph("Test")]);
  const jsonString = JSON.stringify(tiptapDoc);

  t.notThrows(() => {
    jsonToYDoc(jsonString, ydoc, schema, "default");
  });

  const fragment = ydoc.getXmlFragment("default");
  t.true(fragment.length > 0);
});

test("jsonToYDoc accepts JSON object", (t) => {
  const ydoc = new Y.Doc();
  const tiptapDoc = createTiptapDoc([createParagraph("Test")]);

  t.notThrows(() => {
    jsonToYDoc(tiptapDoc, ydoc, schema, "default");
  });

  const fragment = ydoc.getXmlFragment("default");
  t.true(fragment.length > 0);
});

test("jsonToYDoc uses custom field name", (t) => {
  const ydoc = new Y.Doc();
  const tiptapDoc = createTiptapDoc([createParagraph("Test")]);

  jsonToYDoc(tiptapDoc, ydoc, schema, "custom");

  const defaultFragment = ydoc.getXmlFragment("default");
  const customFragment = ydoc.getXmlFragment("custom");

  t.is(defaultFragment.length, 0);
  t.true(customFragment.length > 0);
});

test("jsonToYDoc clears existing content", (t) => {
  const ydoc = new Y.Doc();

  // Add initial content
  const doc1 = createTiptapDoc([createParagraph("First")]);
  jsonToYDoc(doc1, ydoc, schema, "default");

  // Replace with new content
  const doc2 = createTiptapDoc([createParagraph("Second")]);
  jsonToYDoc(doc2, ydoc, schema, "default");

  // Convert back to verify
  const result = yDocToJSON(ydoc, schema, "default");
  const parsed = JSON.parse(result);

  t.is(parsed.content.length, 1);
  t.is(parsed.content[0].type, "paragraph");
});

test("jsonToYDoc throws error for invalid JSON string", (t) => {
  const ydoc = new Y.Doc();
  const invalidJson = "not valid json {";

  const error = t.throws(() => {
    jsonToYDoc(invalidJson, ydoc, schema, "default");
  });

  t.truthy(error);
  t.true(error.message.includes("Failed to convert JSON to YDoc"));
});

test("jsonToYDoc throws error for invalid node structure", (t) => {
  const ydoc = new Y.Doc();
  const invalidDoc = {
    type: "invalidNodeType",
    content: [],
  };

  const error = t.throws(() => {
    jsonToYDoc(invalidDoc, ydoc, schema, "default");
  });

  t.truthy(error);
  t.true(error.message.includes("Failed to convert JSON to YDoc"));
});

// Round-trip tests (JSON → YDoc → JSON)
test("Round-trip: empty document", (t) => {
  const ydoc = new Y.Doc();
  const original = createTiptapDoc([]);

  jsonToYDoc(original, ydoc, schema, "test");
  const result = yDocToJSON(ydoc, schema, "test");
  const parsed = JSON.parse(result);

  t.is(parsed.type, "doc");
  t.deepEqual(parsed.content, []);
});

test("Round-trip: document with simple paragraph", (t) => {
  const ydoc = new Y.Doc();
  const original = createTiptapDoc([createParagraph("Hello World")]);

  jsonToYDoc(original, ydoc, schema, "test");
  const result = yDocToJSON(ydoc, schema, "test");
  const parsed = JSON.parse(result);

  t.is(parsed.type, "doc");
  t.is(parsed.content.length, 1);
  t.is(parsed.content[0].type, "paragraph");
  t.is(parsed.content[0].content[0].type, "text");
  t.is(parsed.content[0].content[0].text, "Hello World");
});

test("Round-trip: document with heading", (t) => {
  const ydoc = new Y.Doc();
  const original = createTiptapDoc([createHeading(1, "Main Title")]);

  jsonToYDoc(original, ydoc, schema, "test");
  const result = yDocToJSON(ydoc, schema, "test");
  const parsed = JSON.parse(result);

  t.is(parsed.content.length, 1);
  t.is(parsed.content[0].type, "heading");
  t.is(parsed.content[0].attrs.level, 1);
  t.is(parsed.content[0].content[0].text, "Main Title");
});

test("Round-trip: document with multiple paragraphs", (t) => {
  const ydoc = new Y.Doc();
  const original = createTiptapDoc([
    createParagraph("First paragraph"),
    createParagraph("Second paragraph"),
    createParagraph("Third paragraph"),
  ]);

  jsonToYDoc(original, ydoc, schema, "test");
  const result = yDocToJSON(ydoc, schema, "test");
  const parsed = JSON.parse(result);

  t.is(parsed.content.length, 3);
  t.is(parsed.content[0].content[0].text, "First paragraph");
  t.is(parsed.content[1].content[0].text, "Second paragraph");
  t.is(parsed.content[2].content[0].text, "Third paragraph");
});

test("Round-trip: document with text formatting", (t) => {
  const ydoc = new Y.Doc();
  const original = createTiptapDoc([
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Normal " },
        { type: "text", text: "bold", marks: [{ type: "bold" }] },
        { type: "text", text: " and " },
        { type: "text", text: "italic", marks: [{ type: "italic" }] },
      ],
    },
  ]);

  jsonToYDoc(original, ydoc, schema, "test");
  const result = yDocToJSON(ydoc, schema, "test");
  const parsed = JSON.parse(result);

  t.is(parsed.content[0].type, "paragraph");
  t.is(parsed.content[0].content.length, 4);

  // Check bold text has mark
  const boldText = parsed.content[0].content[1];
  t.is(boldText.text, "bold");
  t.truthy(boldText.marks);
  t.is(boldText.marks[0].type, "bold");

  // Check italic text has mark
  const italicText = parsed.content[0].content[3];
  t.is(italicText.text, "italic");
  t.truthy(italicText.marks);
  t.is(italicText.marks[0].type, "italic");
});

test("Round-trip: document with bullet list", (t) => {
  const ydoc = new Y.Doc();
  const original = createTiptapDoc([
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [createParagraph("Item 1")],
        },
        {
          type: "listItem",
          content: [createParagraph("Item 2")],
        },
      ],
    },
  ]);

  jsonToYDoc(original, ydoc, schema, "test");
  const result = yDocToJSON(ydoc, schema, "test");
  const parsed = JSON.parse(result);

  t.is(parsed.content[0].type, "bulletList");
  t.is(parsed.content[0].content.length, 2);
  t.is(parsed.content[0].content[0].type, "listItem");
  t.is(parsed.content[0].content[1].type, "listItem");
});

test("Round-trip: document with code block", (t) => {
  const ydoc = new Y.Doc();
  const original = createTiptapDoc([
    {
      type: "codeBlock",
      attrs: { language: "javascript" },
      content: [{ type: "text", text: "const x = 1;" }],
    },
  ]);

  jsonToYDoc(original, ydoc, schema, "test");
  const result = yDocToJSON(ydoc, schema, "test");
  const parsed = JSON.parse(result);

  t.is(parsed.content[0].type, "codeBlock");
  t.is(parsed.content[0].attrs.language, "javascript");
  t.is(parsed.content[0].content[0].text, "const x = 1;");
});

test("Round-trip: complex document", (t) => {
  const ydoc = new Y.Doc();
  const original = createTiptapDoc([
    createHeading(1, "Title"),
    createParagraph("Introduction text"),
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [createParagraph("Point 1")] },
        { type: "listItem", content: [createParagraph("Point 2")] },
      ],
    },
    createHeading(2, "Subtitle"),
    createParagraph("Conclusion"),
  ]);

  jsonToYDoc(original, ydoc, schema, "test");
  const result = yDocToJSON(ydoc, schema, "test");
  const parsed = JSON.parse(result);

  t.is(parsed.content.length, 5);
  t.is(parsed.content[0].type, "heading");
  t.is(parsed.content[1].type, "paragraph");
  t.is(parsed.content[2].type, "bulletList");
  t.is(parsed.content[3].type, "heading");
  t.is(parsed.content[4].type, "paragraph");
});

// Concurrent modifications (CRDT behavior)
test("Multiple updates to same YDoc maintain consistency", (t) => {
  const ydoc = new Y.Doc();

  // First update
  const doc1 = createTiptapDoc([createParagraph("First")]);
  jsonToYDoc(doc1, ydoc, schema, "test");

  // Second update
  const doc2 = createTiptapDoc([
    createParagraph("First"),
    createParagraph("Second"),
  ]);
  jsonToYDoc(doc2, ydoc, schema, "test");

  // Third update
  const doc3 = createTiptapDoc([
    createParagraph("First"),
    createParagraph("Second"),
    createParagraph("Third"),
  ]);
  jsonToYDoc(doc3, ydoc, schema, "test");

  const result = yDocToJSON(ydoc, schema, "test");
  const parsed = JSON.parse(result);

  t.is(parsed.content.length, 3);
});

test("YDoc transactions are atomic", (t) => {
  const ydoc = new Y.Doc();
  const updates: any[] = [];

  // Listen for updates
  ydoc.on("update", (update: Uint8Array) => {
    updates.push(update);
  });

  const doc = createTiptapDoc([createParagraph("Test")]);
  jsonToYDoc(doc, ydoc, schema, "test");

  // Should have exactly one update event (atomic transaction)
  t.is(updates.length, 1);
});

test("Different field names are independent", (t) => {
  const ydoc = new Y.Doc();

  const doc1 = createTiptapDoc([createParagraph("Field 1")]);
  const doc2 = createTiptapDoc([createParagraph("Field 2")]);

  jsonToYDoc(doc1, ydoc, schema, "field1");
  jsonToYDoc(doc2, ydoc, schema, "field2");

  const result1 = yDocToJSON(ydoc, schema, "field1");
  const result2 = yDocToJSON(ydoc, schema, "field2");

  const parsed1 = JSON.parse(result1);
  const parsed2 = JSON.parse(result2);

  t.is(parsed1.content[0].content[0].text, "Field 1");
  t.is(parsed2.content[0].content[0].text, "Field 2");
});

// Attribute sanitization tests
test("Heading level is clamped between 1-6", (t) => {
  const ydoc = new Y.Doc();

  // Test level 0 (should become 1)
  const doc1 = createTiptapDoc([
    {
      type: "heading",
      attrs: { level: 0 },
      content: [{ type: "text", text: "Level 0" }],
    },
  ]);
  jsonToYDoc(doc1, ydoc, schema, "test");
  const result1 = JSON.parse(yDocToJSON(ydoc, schema, "test"));
  t.is(result1.content[0].attrs.level, 1);

  // Test level 10 (should become 6)
  const doc2 = createTiptapDoc([
    {
      type: "heading",
      attrs: { level: 10 },
      content: [{ type: "text", text: "Level 10" }],
    },
  ]);
  jsonToYDoc(doc2, ydoc, schema, "test");
  const result2 = JSON.parse(yDocToJSON(ydoc, schema, "test"));
  t.is(result2.content[0].attrs.level, 6);
});

test("Paragraph textAlign preserves valid values", (t) => {
  const ydoc = new Y.Doc();
  const alignments = ["left", "center", "right", "justify"];

  alignments.forEach((align) => {
    const doc = createTiptapDoc([
      {
        type: "paragraph",
        attrs: { textAlign: align },
        content: [{ type: "text", text: "Aligned" }],
      },
    ]);
    jsonToYDoc(doc, ydoc, schema, "test");
    const result = JSON.parse(yDocToJSON(ydoc, schema, "test"));
    t.is(result.content[0].attrs.textAlign, align);
  });
});

test("Paragraph textAlign ignores invalid values", (t) => {
  const ydoc = new Y.Doc();
  const doc = createTiptapDoc([
    {
      type: "paragraph",
      attrs: { textAlign: "invalid" },
      content: [{ type: "text", text: "Text" }],
    },
  ]);

  jsonToYDoc(doc, ydoc, schema, "test");
  const result = JSON.parse(yDocToJSON(ydoc, schema, "test"));

  // Invalid textAlign should not be preserved
  t.falsy(result.content[0].attrs?.textAlign);
});

test("OrderedList start attribute preserved if positive", (t) => {
  const ydoc = new Y.Doc();
  const doc = createTiptapDoc([
    {
      type: "orderedList",
      attrs: { start: 5 },
      content: [{ type: "listItem", content: [createParagraph("Item")] }],
    },
  ]);

  jsonToYDoc(doc, ydoc, schema, "test");
  const result = JSON.parse(yDocToJSON(ydoc, schema, "test"));

  t.is(result.content[0].attrs.start, 5);
});

test("OrderedList ignores negative start values", (t) => {
  const ydoc = new Y.Doc();
  const doc = createTiptapDoc([
    {
      type: "orderedList",
      attrs: { start: -1 },
      content: [{ type: "listItem", content: [createParagraph("Item")] }],
    },
  ]);

  jsonToYDoc(doc, ydoc, schema, "test");
  const result = JSON.parse(yDocToJSON(ydoc, schema, "test"));

  // Negative start should not be preserved
  t.falsy(result.content[0].attrs?.start);
});

test("CodeBlock language attribute preserved", (t) => {
  const ydoc = new Y.Doc();
  const languages = ["javascript", "python", "typescript", "rust"];

  languages.forEach((lang) => {
    const doc = createTiptapDoc([
      {
        type: "codeBlock",
        attrs: { language: lang },
        content: [{ type: "text", text: "code" }],
      },
    ]);
    jsonToYDoc(doc, ydoc, schema, "test");
    const result = JSON.parse(yDocToJSON(ydoc, schema, "test"));
    t.is(result.content[0].attrs.language, lang);
  });
});

test("CodeBlock ignores empty language", (t) => {
  const ydoc = new Y.Doc();
  const doc = createTiptapDoc([
    {
      type: "codeBlock",
      attrs: { language: "" },
      content: [{ type: "text", text: "code" }],
    },
  ]);

  jsonToYDoc(doc, ydoc, schema, "test");
  const result = JSON.parse(yDocToJSON(ydoc, schema, "test"));

  // Empty language should not be preserved
  t.falsy(result.content[0].attrs?.language);
});

test("Image src and alt attributes preserved", (t) => {
  const ydoc = new Y.Doc();
  const doc = createTiptapDoc([
    {
      type: "image",
      attrs: {
        src: "https://example.com/image.jpg",
        alt: "Example image",
        title: "Image title",
      },
    },
  ]);

  jsonToYDoc(doc, ydoc, schema, "test");
  const result = JSON.parse(yDocToJSON(ydoc, schema, "test"));

  t.is(result.content[0].attrs.src, "https://example.com/image.jpg");
  t.is(result.content[0].attrs.alt, "Example image");
  t.is(result.content[0].attrs.title, "Image title");
});

test("Image ignores empty src", (t) => {
  const ydoc = new Y.Doc();
  const doc = createTiptapDoc([
    { type: "image", attrs: { src: "", alt: "Empty src" } },
  ]);

  jsonToYDoc(doc, ydoc, schema, "test");
  const result = JSON.parse(yDocToJSON(ydoc, schema, "test"));

  // Empty src should not be preserved (may cause error or be filtered)
  if (result.content[0]) {
    t.falsy(
      result.content[0].attrs?.src || result.content[0].attrs?.src === ""
    );
  }
});

test("Link mark attributes preserved", (t) => {
  const ydoc = new Y.Doc();
  const doc = createTiptapDoc([
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Link text",
          marks: [
            {
              type: "link",
              attrs: {
                href: "https://example.com",
                title: "Example",
                target: "_blank",
              },
            },
          ],
        },
      ],
    },
  ]);

  jsonToYDoc(doc, ydoc, schema, "test");
  const result = JSON.parse(yDocToJSON(ydoc, schema, "test"));

  const linkMark = result.content[0].content[0].marks[0];
  t.is(linkMark.type, "link");
  t.is(linkMark.attrs.href, "https://example.com");
  t.is(linkMark.attrs.title, "Example");
  t.is(linkMark.attrs.target, "_blank");
});

test("Link mark ignores empty href", (t) => {
  const ydoc = new Y.Doc();
  const doc = createTiptapDoc([
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Link text",
          marks: [{ type: "link", attrs: { href: "" } }],
        },
      ],
    },
  ]);

  jsonToYDoc(doc, ydoc, schema, "test");
  const result = JSON.parse(yDocToJSON(ydoc, schema, "test"));

  // Empty href should not be preserved or mark should be removed
  const marks = result.content[0].content[0].marks;
  if (marks && marks.length > 0) {
    t.falsy(marks[0].attrs?.href || marks[0].attrs?.href === "");
  }
});

test("Highlight mark with color preserved", (t) => {
  const ydoc = new Y.Doc();
  const doc = createTiptapDoc([
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Highlighted",
          marks: [{ type: "highlight", attrs: { color: "#ffff00" } }],
        },
      ],
    },
  ]);

  jsonToYDoc(doc, ydoc, schema, "test");
  const result = JSON.parse(yDocToJSON(ydoc, schema, "test"));

  const highlightMark = result.content[0].content[0].marks.find(
    (m: any) => m.type === "highlight"
  );
  t.truthy(highlightMark);
  t.is(highlightMark.attrs.color, "#ffff00");
});

test("TextStyle mark with color preserved", (t) => {
  const ydoc = new Y.Doc();
  const doc = createTiptapDoc([
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Colored text",
          marks: [{ type: "textStyle", attrs: { color: "#ff0000" } }],
        },
      ],
    },
  ]);

  jsonToYDoc(doc, ydoc, schema, "test");
  const result = JSON.parse(yDocToJSON(ydoc, schema, "test"));

  const textStyleMark = result.content[0].content[0].marks.find(
    (m: any) => m.type === "textStyle"
  );
  t.truthy(textStyleMark);
  t.is(textStyleMark.attrs.color, "#ff0000");
});

test("Table cell colspan and rowspan preserved", (t) => {
  const ydoc = new Y.Doc();
  const doc = createTiptapDoc([
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              attrs: { colspan: 2, rowspan: 1 },
              content: [createParagraph("Cell")],
            },
          ],
        },
      ],
    },
  ]);

  jsonToYDoc(doc, ydoc, schema, "test");
  const result = JSON.parse(yDocToJSON(ydoc, schema, "test"));

  const cell = result.content[0].content[0].content[0];
  t.is(cell.attrs.colspan, 2);
  t.is(cell.attrs.rowspan, 1);
});

test("Multiple marks on same text preserved", (t) => {
  const ydoc = new Y.Doc();
  const doc = createTiptapDoc([
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Bold italic underline",
          marks: [{ type: "bold" }, { type: "italic" }, { type: "underline" }],
        },
      ],
    },
  ]);

  jsonToYDoc(doc, ydoc, schema, "test");
  const result = JSON.parse(yDocToJSON(ydoc, schema, "test"));

  const marks = result.content[0].content[0].marks;
  t.is(marks.length, 3);

  const markTypes = marks.map((m: any) => m.type);
  t.true(markTypes.includes("bold"));
  t.true(markTypes.includes("italic"));
  t.true(markTypes.includes("underline"));
});
