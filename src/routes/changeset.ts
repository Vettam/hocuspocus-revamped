import { Router, Request, Response } from "express";
import { schema } from "../utils/ydoc/schema";
import { simplifyChanges, Change, Span } from "prosemirror-changeset";
import { Node as ProsemirrorNode } from "prosemirror-model";
import { Transform } from "prosemirror-transform";

const changesetRouter = Router();

/**
 * SIMPLIFIED WORKFLOW (No Y.js merge complexity):
 * 
 * 1. User clicks "Improve with AI" at state A
 * 2. LLM regenerates ENTIRE document (returns A_llm)
 * 3. We compute changeset: A → A_llm
 * 4. Show changeset to user for approval
 * 5. MEANWHILE: other users edit, doc is now at state B
 * 6. User approves changeset
 * 7. We apply the SAME TEXT CHANGES to B, accounting for position shifts
 * 
 * This is the pragmatic approach: apply text-level diffs directly
 */

interface ChangesetApprovalData {
  changesetId: string;
  originalDoc: any;           // State A (JSON)
  llmDoc: any;                // A_llm (JSON)
  textChanges: TextChange[];  // Computed text-level changes
  timestamp: number;
}

interface TextChange {
  position: number;
  deleteLength: number;
  insertText: string;
  context: string; // Surrounding text for matching
}

// In-memory storage for POC
const pendingChangesets = new Map<string, ChangesetApprovalData>();

/**
 * Step 1: Generate LLM changes and create approval request
 * POST /v1/changeset/generate/:draftId
 */
changesetRouter.post("/generate/:draftId", async (req: Request, res: Response) => {
  try {
    const { currentDoc } = req.body;

    // State A: Current document
    const pmDocA = schema.nodeFromJSON(currentDoc);
    
    // LLM generates new version
    const llmDoc = await generateLLMVersion(currentDoc);
    const pmDocA_llm = schema.nodeFromJSON(llmDoc);
    
    // Compute changeset A → A_llm
    const changes = computeChanges(pmDocA, pmDocA_llm);
    const simplified = simplifyChanges(changes, pmDocA_llm);
    const changeset = formatChangeset(simplified, pmDocA, pmDocA_llm);
    
    // Extract text-level changes for later application
    const textChanges = extractTextChanges(pmDocA, pmDocA_llm, simplified);
    
    // Store for approval
    const changesetId = `changeset_${Date.now()}_${Math.random()}`;
    pendingChangesets.set(changesetId, {
      changesetId,
      originalDoc: currentDoc,
      llmDoc,
      textChanges,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      changesetId,
      changeset,
      preview: {
        originalText: pmDocA.textContent,
        improvedText: pmDocA_llm.textContent
      },
      message: "LLM changes generated. Review and approve to apply."
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Step 2: Apply approved changeset to current document state
 * POST /v1/changeset/approve/:changesetId
 */
changesetRouter.post("/approve/:changesetId", async (req: Request, res: Response) => {
  try {
    const { changesetId } = req.params;
    const { currentDoc } = req.body;

    const approvalData = pendingChangesets.get(changesetId);
    if (!approvalData) {
      res.status(404).json({
        success: false,
        error: "Changeset not found or expired"
      });
      return;
    }

    const { originalDoc, llmDoc, textChanges } = approvalData;

    // Check if document changed
    const pmDocA = schema.nodeFromJSON(originalDoc);
    const pmDocB = schema.nodeFromJSON(currentDoc);
    const documentChanged = pmDocA.textContent !== pmDocB.textContent;

    let finalDoc: any;
    let appliedChangeset: any;

    if (!documentChanged) {
      // Simple case: no concurrent edits, just apply LLM version
      finalDoc = llmDoc;
      appliedChangeset = formatChangeset(
        simplifyChanges(computeChanges(pmDocB, schema.nodeFromJSON(llmDoc)), schema.nodeFromJSON(llmDoc)),
        pmDocB,
        schema.nodeFromJSON(llmDoc)
      );
    } else {
      // Complex case: merge LLM changes with user edits
      const pmDocB_prime = applyTextChangesToDoc(pmDocB, textChanges);
      finalDoc = pmDocB_prime.toJSON();
      
      appliedChangeset = formatChangeset(
        simplifyChanges(computeChanges(pmDocB, pmDocB_prime), pmDocB_prime),
        pmDocB,
        pmDocB_prime
      );
    }

    pendingChangesets.delete(changesetId);

    res.json({
      success: true,
      documentChanged,
      message: documentChanged 
        ? "Document was edited during review. LLM changes merged with user edits."
        : "LLM changes applied successfully.",
      result: {
        originalDoc: currentDoc,
        mergedDoc: finalDoc,
        appliedChangeset
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Test endpoint demonstrating the full workflow
 */
changesetRouter.post("/test/:draftId/:versionId", async (req: Request, res: Response) => {
  try {
    const { draftId, versionId } = req.params;

    // State A: Original
    const docA = createTestDoc("original");
    const pmDocA = schema.nodeFromJSON(docA);

    // State A_llm: LLM improved
    const docA_llm = createTestDoc("llm_improved");
    const pmDocA_llm = schema.nodeFromJSON(docA_llm);

    // State B: User edits
    const docB = createTestDoc("user_edited");
    const pmDocB = schema.nodeFromJSON(docB);

    // Compute changeset A → A_llm (what user sees)
    const changesetA_to_Allm = computeAndFormatChangeset(pmDocA, pmDocA_llm);
    
    // Extract text changes from A → A_llm
    const textChanges = extractTextChanges(pmDocA, pmDocA_llm, computeChanges(pmDocA, pmDocA_llm));
    
    // Apply those same changes to B → B_prime
    const pmDocB_prime = applyTextChangesToDoc(pmDocB, textChanges);
    const docB_prime = pmDocB_prime.toJSON();
    
    // Compute changeset B → B_prime (what actually gets applied)
    const changesetB_to_Bprime = computeAndFormatChangeset(pmDocB, pmDocB_prime);

    res.json({
      success: true,
      draftId,
      versionId,
      workflow: {
        step1_userClicksAI: {
          description: "User clicks 'Improve with AI' at state A",
          stateA: docA,
          textA: pmDocA.textContent
        },
        step2_llmGenerates: {
          description: "LLM regenerates entire document → A_llm",
          stateA_llm: docA_llm,
          textA_llm: pmDocA_llm.textContent,
          changesetShownToUser: changesetA_to_Allm
        },
        step3_concurrentEdits: {
          description: "While user reviews, others edit A → B",
          stateB: docB,
          textB: pmDocB.textContent
        },
        step4_userApproves: {
          description: "User approves. We apply LLM changes to current state B → B_prime",
          stateB_prime: docB_prime,
          textB_prime: pmDocB_prime.textContent,
          actualChangesApplied: changesetB_to_Bprime
        }
      },
      explanation: {
        keyInsight: "We extract text-level changes from A→A_llm and apply them to B, preserving user edits",
        approach: "Direct text transformation using ProseMirror transforms",
        formula: "B_prime = apply(B, textChanges(A→A_llm))"
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// ============================================================
// Helper Functions
// ============================================================

function createTestDoc(version: "original" | "llm_improved" | "user_edited") {
  const base = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Project Overview" }]
      },
      {
        type: "paragraph",
        content: [{ 
          type: "text", 
          text: version === "llm_improved" 
            ? "This is a comprehensive test document for demonstrating collaborative editing capabilities."
            : "This is a test document for collaboration."
        }]
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "First task item" }] }]
          },
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Second task item" }] }]
          }
        ]
      }
    ]
  };

  if (version === "user_edited") {
    (base.content[2].content as any[]).push({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Third task added by user" }] }]
    });
    base.content.push({
      type: "paragraph",
      content: [{ type: "text", text: "User added this additional paragraph with important notes." }]
    });
  }

  return base;
}

async function generateLLMVersion(doc: any): Promise<any> {
  // Mock LLM - improves the first paragraph
  const improved = JSON.parse(JSON.stringify(doc));
  improved.content = improved.content.map((node: any) => {
    if (node.type === "paragraph" && node.content?.[0]?.text?.includes("test document")) {
      return {
        ...node,
        content: [{
          type: "text",
          text: "This is a comprehensive test document for demonstrating collaborative editing capabilities."
        }]
      };
    }
    return node;
  });
  return improved;
}

function extractTextChanges(oldDoc: ProsemirrorNode, newDoc: ProsemirrorNode, changes: Change[]): TextChange[] {
  const textChanges: TextChange[] = [];
  
  changes.forEach(change => {
    const deletedLength = change.toA - change.fromA;
    const insertedText = newDoc.textBetween(change.fromB, change.toB);
    
    // Get context (10 chars before) for position matching
    const contextStart = Math.max(0, change.fromA - 10);
    const context = oldDoc.textBetween(contextStart, change.fromA);
    
    textChanges.push({
      position: change.fromA,
      deleteLength: deletedLength,
      insertText: insertedText,
      context
    });
  });
  
  return textChanges;
}

function applyTextChangesToDoc(doc: ProsemirrorNode, textChanges: TextChange[]): ProsemirrorNode {
  let tr = new Transform(doc);
  
  // Apply changes in reverse order to maintain positions
  const sortedChanges = [...textChanges].sort((a, b) => b.position - a.position);
  
  sortedChanges.forEach(change => {
    // Find the actual position in current doc (might have shifted)
    let position = findPositionWithContext(tr.doc, change.position, change.context);
    
    if (position !== -1) {
      // Delete old content
      if (change.deleteLength > 0) {
        tr.delete(position, position + change.deleteLength);
      }
      
      // Insert new content
      if (change.insertText) {
        tr.replaceWith(position, position, schema.text(change.insertText));
      }
    }
  });
  
  return tr.doc;
}

function findPositionWithContext(doc: ProsemirrorNode, originalPos: number, context: string): number {
  // Try exact position first
  if (originalPos <= doc.content.size) {
    const start = Math.max(0, originalPos - context.length);
    const actualContext = doc.textBetween(start, originalPos);
    if (actualContext === context) {
      return originalPos;
    }
  }
  
  // Search for context match
  const fullText = doc.textContent;
  const contextPos = fullText.indexOf(context);
  if (contextPos !== -1) {
    return contextPos + context.length;
  }
  
  // Fallback to original position
  return Math.min(originalPos, doc.content.size);
}

function computeChanges(oldDoc: ProsemirrorNode, newDoc: ProsemirrorNode): Change[] {
  const changes: Change[] = [];
  const oldText = oldDoc.textContent;
  const newText = newDoc.textContent;
  
  let commonStart = 0;
  while (commonStart < oldText.length && commonStart < newText.length && 
         oldText[commonStart] === newText[commonStart]) {
    commonStart++;
  }
  
  let commonEnd = 0;
  while (commonEnd < oldText.length - commonStart && 
         commonEnd < newText.length - commonStart &&
         oldText[oldText.length - 1 - commonEnd] === newText[newText.length - 1 - commonEnd]) {
    commonEnd++;
  }
  
  const oldChanged = oldText.length - commonStart - commonEnd;
  const newChanged = newText.length - commonStart - commonEnd;
  
  if (oldChanged > 0 || newChanged > 0) {
    const deleted: Span[] = oldChanged > 0 ? [{ length: oldChanged, data: null } as any] : [];
    const inserted: Span[] = newChanged > 0 ? [{ length: newChanged, data: null } as any] : [];
    
    changes.push({
      fromA: commonStart,
      toA: commonStart + oldChanged,
      fromB: commonStart,
      toB: commonStart + newChanged,
      deleted,
      inserted,
    } as any);
  }
  
  return changes;
}

function formatChangeset(changes: readonly Change[], oldDoc: ProsemirrorNode, newDoc: ProsemirrorNode) {
  const formattedChanges: any[] = [];
  let totalInsertions = 0;
  let totalDeletions = 0;

  changes.forEach((change) => {
    const deletedLength = change.deleted.reduce((sum, span) => sum + span.length, 0);
    const insertedLength = change.inserted.reduce((sum, span) => sum + span.length, 0);
    
    totalDeletions += deletedLength;
    totalInsertions += insertedLength;

    formattedChanges.push({
      type: 'change',
      fromA: change.fromA,
      toA: change.toA,
      fromB: change.fromB,
      toB: change.toB,
      deletedText: oldDoc.textBetween(change.fromA, change.toA),
      insertedText: newDoc.textBetween(change.fromB, change.toB),
      deletedLength,
      insertedLength,
    });
  });

  return {
    summary: { insertions: totalInsertions, deletions: totalDeletions, totalChanges: changes.length },
    changes: formattedChanges
  };
}

function computeAndFormatChangeset(docA: ProsemirrorNode, docB: ProsemirrorNode) {
  const changes = computeChanges(docA, docB);
  const simplified = simplifyChanges(changes, docB);
  return formatChangeset(simplified, docA, docB);
}

export default changesetRouter;