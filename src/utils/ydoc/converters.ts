import * as Y from "yjs";
import {
  prosemirrorToYXmlFragment,
  yXmlFragmentToProsemirror,
} from "y-prosemirror";
import { Schema } from "prosemirror-model";

export interface TiptapJSON {
  type: "doc";
  content?: Array<{
    type: string;
    attrs?: Record<string, unknown>;
    content?: Array<Record<string, unknown>>;
    text?: string;
    marks?: Array<{
      type: string;
      attrs?: Record<string, unknown>;
    }>;
  }>;
}

/**
 * Convert YDoc to Tiptap JSON format
 * @param ydoc - The Y.js document
 * @param schema - ProseMirror schema
 * @param fieldName - The Y.XmlFragment field name
 * @returns Tiptap-compatible JSON
 * @throws Error if conversion fails
 */
function yDocToJSON(
  ydoc: Y.Doc,
  schema: Schema,
  fieldName: string = "shared"
): string {
  try {
    const yXmlFragment = ydoc.getXmlFragment(fieldName);

    if (!yXmlFragment || yXmlFragment.length === 0) {
      return JSON.stringify({
        type: "doc",
        content: [],
      });
    }

    const pmNode = yXmlFragmentToProsemirror(schema, yXmlFragment);

    return JSON.stringify({
      type: "doc",
      content: pmNode.content.size > 0 ? convertNodeToJSON(pmNode) : [],
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Check if it's an unknown node type error
    if (errorMessage.includes("Unknown node type")) {
      console.error(`[onChange] ${errorMessage}`);
      console.error(
        "Tip: Add the missing node type to your ProseMirror schema in src/utils/ydoc/schema.ts"
      );

      // Return empty doc instead of crashing
      return JSON.stringify({
        type: "doc",
        content: [],
      });
    }

    throw new Error(`Failed to convert YDoc to JSON: ${errorMessage}`);
  }
}

/**
 * Convert Tiptap JSON to YDoc
 * @param json - Tiptap JSON object
 * @param ydoc - The Y.js document to update
 * @param schema - ProseMirror schema
 * @param fieldName - The Y.XmlFragment field name
 * @throws Error if conversion fails
 */
function jsonToYDoc(
  json: string,
  ydoc: Y.Doc,
  schema: Schema,
  fieldName: string = "default"
): void {
  try {
    const yXmlFragment = ydoc.getXmlFragment(fieldName);
    yXmlFragment.delete(0, yXmlFragment.length);

    const pmNode = schema.nodeFromJSON(json);
    prosemirrorToYXmlFragment(pmNode, yXmlFragment);
  } catch (error) {
    throw new Error(
      `Failed to convert JSON to YDoc: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Recursively convert ProseMirror node to JSON with support for extended node types
 */
function convertNodeToJSON(
  node: ReturnType<typeof yXmlFragmentToProsemirror>
): Array<{
  type: string;
  attrs?: Record<string, unknown>;
  content?: Array<Record<string, unknown>>;
  text?: string;
  marks?: Array<{
    type: string;
    attrs?: Record<string, unknown>;
  }>;
}> {
  const nodes: Array<{
    type: string;
    attrs?: Record<string, unknown>;
    content?: Array<Record<string, unknown>>;
    text?: string;
    marks?: Array<{
      type: string;
      attrs?: Record<string, unknown>;
    }>;
  }> = [];

  node.content.forEach((child) => {
    try {
      const json: {
        type: string;
        attrs?: Record<string, unknown>;
        content?: Array<Record<string, unknown>>;
        text?: string;
        marks?: Array<{
          type: string;
          attrs?: Record<string, unknown>;
        }>;
      } = {
        type: child.type.name,
      };

      // Handle attributes (alignment, colspan, rowspan, href, language, etc.)
      const attrs = sanitizeAttributes(child.type.name, child.attrs);
      if (Object.keys(attrs).length > 0) {
        json.attrs = attrs;
      }

      // Handle nested content (paragraphs, list items, table cells, etc.)
      if (child.content.size > 0) {
        json.content = convertNodeToJSON(child);
      }

      // Handle text nodes with marks (bold, italic, link, strikethrough, etc.)
      if (child.isText && child.text) {
        json.text = child.text;

        if (child.marks.length > 0) {
          json.marks = child.marks
            .map((mark) => {
              const markAttrs = sanitizeMarkAttributes(
                mark.type.name,
                mark.attrs
              );
              return {
                type: mark.type.name,
                ...(Object.keys(markAttrs).length > 0 && { attrs: markAttrs }),
              };
            })
            .filter((mark) => mark.type); // Remove invalid marks
        }
      }

      nodes.push(json);
    } catch (nodeError) {
      console.warn(
        `Warning: Failed to convert node of type "${child.type.name}":`,
        nodeError instanceof Error ? nodeError.message : "Unknown error"
      );
      // Skip problematic nodes instead of crashing
    }
  });

  return nodes;
}

/**
 * Sanitize and validate node attributes based on node type
 */
function sanitizeAttributes(
  nodeType: string,
  attrs: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  switch (nodeType) {
    // Heading
    case "heading":
      if (typeof attrs.level === "number") {
        sanitized.level = Math.max(1, Math.min(6, attrs.level));
      }
      break;

    // Paragraph with alignment
    case "paragraph":
      if (
        attrs.textAlign &&
        ["left", "center", "right", "justify"].includes(String(attrs.textAlign))
      ) {
        sanitized.textAlign = attrs.textAlign;
      }
      break;

    // Lists with start value
    case "orderedList":
      if (typeof attrs.start === "number" && attrs.start > 0) {
        sanitized.start = attrs.start;
      }
      break;

    // Code block with language
    case "codeBlock":
      if (typeof attrs.language === "string" && attrs.language.length > 0) {
        sanitized.language = attrs.language;
      }
      break;

    // Table cells with colspan/rowspan
    case "tableCell":
    case "tableHeader":
      if (typeof attrs.colspan === "number" && attrs.colspan > 0) {
        sanitized.colspan = attrs.colspan;
      }
      if (typeof attrs.rowspan === "number" && attrs.rowspan > 0) {
        sanitized.rowspan = attrs.rowspan;
      }
      if (typeof attrs.colwidth === "object" && Array.isArray(attrs.colwidth)) {
        sanitized.colwidth = attrs.colwidth;
      }
      break;

    // Image with source and alt
    case "image":
      if (typeof attrs.src === "string" && attrs.src.length > 0) {
        sanitized.src = attrs.src;
      }
      if (typeof attrs.alt === "string") {
        sanitized.alt = attrs.alt;
      }
      if (typeof attrs.title === "string") {
        sanitized.title = attrs.title;
      }
      break;

    // Horizontal rule typically has no attrs
    case "horizontalRule":
      break;

    // Default: pass through all attributes
    default:
      return attrs;
  }

  return sanitized;
}

/**
 * Sanitize and validate mark attributes based on mark type
 */
function sanitizeMarkAttributes(
  markType: string,
  attrs: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  switch (markType) {
    // Link with href
    case "link":
      if (typeof attrs.href === "string" && attrs.href.length > 0) {
        sanitized.href = attrs.href;
      }
      if (typeof attrs.title === "string") {
        sanitized.title = attrs.title;
      }
      if (typeof attrs.target === "string") {
        sanitized.target = attrs.target;
      }
      break;

    // Highlight/background color
    case "highlight":
      if (typeof attrs.color === "string" && attrs.color.length > 0) {
        sanitized.color = attrs.color;
      }
      break;

    // Text color
    case "textStyle":
      if (typeof attrs.color === "string" && attrs.color.length > 0) {
        sanitized.color = attrs.color;
      }
      break;

    // Bold, italic, underline, strikethrough, code, subscript, superscript
    case "bold":
    case "italic":
    case "underline":
    case "strike":
    case "strikethrough":
    case "code":
    case "sub":
    case "sup":
      // These typically don't have attributes
      break;

    // Default: pass through attributes
    default:
      return attrs;
  }

  return sanitized;
}
export { yDocToJSON, jsonToYDoc };
