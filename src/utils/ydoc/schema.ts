import { Schema } from 'prosemirror-model'

// Enhanced ProseMirror schema with table support
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    
    paragraph: {
      group: 'block',
      content: 'inline*',
      attrs: { textAlign: { default: null } },
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    },
    
    text: { group: 'inline' },
    
    heading: {
      group: 'block',
      content: 'inline*',
      attrs: { level: { default: 1 } },
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } },
        { tag: 'h4', attrs: { level: 4 } },
        { tag: 'h5', attrs: { level: 5 } },
        { tag: 'h6', attrs: { level: 6 } },
      ],
      toDOM: node => ['h' + node.attrs.level, 0],
    },

    // List nodes
    bulletList: {
      group: 'block',
      content: 'listItem+',
      parseDOM: [{ tag: 'ul' }],
      toDOM: () => ['ul', 0],
    },

    orderedList: {
      group: 'block',
      content: 'listItem+',
      attrs: { start: { default: 1 } },
      parseDOM: [{ tag: 'ol' }],
      toDOM: () => ['ol', 0],
    },

    listItem: {
      content: 'paragraph block*',
      parseDOM: [{ tag: 'li' }],
      toDOM: () => ['li', 0],
      defining: true,
    },

    // Code block
    codeBlock: {
      group: 'block',
      content: 'text*',
      attrs: { language: { default: null } },
      code: true,
      defining: true,
      marks: '',
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      toDOM: () => ['pre', ['code', 0]],
    },

    // Blockquote
    blockquote: {
      group: 'block',
      content: 'block+',
      parseDOM: [{ tag: 'blockquote' }],
      toDOM: () => ['blockquote', 0],
    },

    // Horizontal rule
    horizontalRule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM: () => ['hr'],
    },

    // Hard break
    hardBreak: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br'],
    },

    // Image
    image: {
      inline: true,
      group: 'inline',
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null },
      },
      parseDOM: [
        {
          tag: 'img[src]',
          getAttrs(dom: any) {
            return {
              src: dom.getAttribute('src'),
              alt: dom.getAttribute('alt'),
              title: dom.getAttribute('title'),
            }
          },
        },
      ],
      toDOM: (node) => ['img', node.attrs],
    },

    // Table nodes
    table: {
      group: 'block',
      content: 'tableRow+',
      tableRole: 'table',
      isolating: true,
      parseDOM: [{ tag: 'table' }],
      toDOM: () => ['table', ['tbody', 0]],
    },

    tableRow: {
      content: '(tableCell | tableHeader)*',
      tableRole: 'row',
      parseDOM: [{ tag: 'tr' }],
      toDOM: () => ['tr', 0],
    },

    tableCell: {
      content: 'block+',
      attrs: {
        colspan: { default: 1 },
        rowspan: { default: 1 },
        colwidth: { default: null },
      },
      tableRole: 'cell',
      isolating: true,
      parseDOM: [{ tag: 'td' }],
      toDOM: () => ['td', 0],
    },

    tableHeader: {
      content: 'block+',
      attrs: {
        colspan: { default: 1 },
        rowspan: { default: 1 },
        colwidth: { default: null },
      },
      tableRole: 'header_cell',
      isolating: true,
      parseDOM: [{ tag: 'th' }],
      toDOM: () => ['th', 0],
    },
  },

  marks: {
    bold: {
      parseDOM: [
        { tag: 'strong' },
        { tag: 'b' },
        { style: 'font-weight=bold' },
        { style: 'font-weight', getAttrs: (value: any) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null },
      ],
      toDOM: () => ['strong', 0],
    },

    italic: {
      parseDOM: [
        { tag: 'em' },
        { tag: 'i' },
        { style: 'font-style=italic' },
      ],
      toDOM: () => ['em', 0],
    },

    underline: {
      parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
      toDOM: () => ['u', 0],
    },

    strike: {
      parseDOM: [
        { tag: 's' },
        { tag: 'strike' },
        { style: 'text-decoration=line-through' },
      ],
      toDOM: () => ['s', 0],
    },

    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM: () => ['code', 0],
    },

    link: {
      attrs: {
        href: {},
        title: { default: null },
        target: { default: null },
      },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs(dom: any) {
            return {
              href: dom.getAttribute('href'),
              title: dom.getAttribute('title'),
              target: dom.getAttribute('target'),
            }
          },
        },
      ],
      toDOM: (node) => ['a', node.attrs, 0],
    },

    highlight: {
      attrs: { color: { default: null } },
      parseDOM: [
        {
          tag: 'mark',
          getAttrs(dom: any) {
            return { color: dom.style.backgroundColor }
          },
        },
      ],
      toDOM: (node) => ['mark', { style: `background-color: ${node.attrs.color}` }, 0],
    },

    textStyle: {
      attrs: { color: { default: null } },
      parseDOM: [
        {
          style: 'color',
          getAttrs(value: any) {
            return { color: value }
          },
        },
      ],
      toDOM: (node) => ['span', { style: `color: ${node.attrs.color}` }, 0],
    },

    subscript: {
      parseDOM: [{ tag: 'sub' }],
      toDOM: () => ['sub', 0],
    },

    superscript: {
      parseDOM: [{ tag: 'sup' }],
      toDOM: () => ['sup', 0],
    },
  },
})

export { schema }
