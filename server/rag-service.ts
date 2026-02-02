import { getDb } from "./db";
import { knowledgeBase, documentChunks, userInteractions, generatedContent } from "../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";

// Chunk text into semantic pieces
function chunkText(text: string, maxChunkSize: number = 1000): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = "";

  for (const para of paragraphs) {
    if (currentChunk.length + para.length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Generate embedding for text using LLM
async function generateEmbedding(text: string): Promise<number[]> {
  // For now, use a simple hash-based pseudo-embedding
  // In production, use OpenAI embeddings or similar
  const hash = text.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  
  // Generate a 384-dimensional pseudo-embedding
  const embedding: number[] = [];
  let seed = Math.abs(hash);
  for (let i = 0; i < 384; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    embedding.push((seed / 0x7fffffff) * 2 - 1);
  }
  return embedding;
}

// Calculate cosine similarity between two embeddings
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Upload and process a document for RAG
export async function uploadDocument(
  userId: number,
  fileName: string,
  content: string,
  mimeType: string,
  category?: string
): Promise<{ documentId: number; chunkCount: number }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Generate unique file key
  const fileKey = `knowledge-base/${userId}/${Date.now()}-${fileName}`;
  
  // Upload to S3
  const { url: fileUrl } = await storagePut(fileKey, content, mimeType);
  
  // Create document record
  const [docResult] = await db.insert(knowledgeBase).values({
    userId,
    fileName,
    fileKey,
    fileUrl,
    mimeType,
    fileSize: content.length,
    category: category || 'general',
    status: 'processing',
    chunkCount: 0,
  });
  
  const documentId = docResult.insertId;
  
  // Chunk the document
  const chunks = chunkText(content);
  
  // Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunkContent = chunks[i];
    const embedding = await generateEmbedding(chunkContent);
    
    await db.insert(documentChunks).values({
      documentId,
      chunkIndex: i,
      content: chunkContent,
      embedding: embedding,
      tokenCount: chunkContent.split(/\s+/).length,
    });
  }
  
  // Update document status
  await db.update(knowledgeBase)
    .set({ status: 'ready', chunkCount: chunks.length })
    .where(eq(knowledgeBase.id, documentId));
  
  return { documentId, chunkCount: chunks.length };
}

// Search knowledge base for relevant context
export async function searchKnowledgeBase(
  query: string,
  userId?: number,
  topK: number = 5
): Promise<{ content: string; documentId: number; fileName: string; score: number }[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);
  
  // Get all chunks (in production, use vector DB like Pinecone)
  const allChunks = await db
    .select({
      id: documentChunks.id,
      documentId: documentChunks.documentId,
      content: documentChunks.content,
      embedding: documentChunks.embedding,
    })
    .from(documentChunks)
    .innerJoin(knowledgeBase, eq(documentChunks.documentId, knowledgeBase.id))
    .where(userId ? eq(knowledgeBase.userId, userId) : sql`1=1`);
  
  // Calculate similarities
  const scored = allChunks.map((chunk: any) => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding as number[] || []),
  }));
  
  // Sort by score and take top K
  scored.sort((a: any, b: any) => b.score - a.score);
  const topChunks = scored.slice(0, topK);
  
  // Get document names
  const results = await Promise.all(topChunks.map(async (chunk: any) => {
    const [doc] = await db
      .select({ fileName: knowledgeBase.fileName })
      .from(knowledgeBase)
      .where(eq(knowledgeBase.id, chunk.documentId));
    
    return {
      content: chunk.content,
      documentId: chunk.documentId,
      fileName: doc?.fileName || 'Unknown',
      score: chunk.score,
    };
  }));
  
  return results;
}

// Get RAG context for AI calls
export async function getRAGContext(
  query: string,
  userId?: number,
  accountId?: number,
  contactId?: number
): Promise<string> {
  const relevantDocs = await searchKnowledgeBase(query, userId, 3);
  
  if (relevantDocs.length === 0) {
    return "";
  }
  
  const contextParts = relevantDocs.map((doc, i) => 
    `[Source ${i + 1}: ${doc.fileName}]\n${doc.content}`
  );
  
  return `\n\n--- RELEVANT KNOWLEDGE BASE CONTEXT ---\n${contextParts.join('\n\n')}\n--- END CONTEXT ---\n`;
}

// Track user interaction
export async function trackInteraction(
  actionType: string,
  inputData: any,
  outputData: any,
  options?: {
    userId?: number;
    sessionId?: string;
    accountId?: number;
    contactId?: number;
    contextUsed?: any;
    durationMs?: number;
  }
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const [result] = await db.insert(userInteractions).values({
    userId: options?.userId,
    sessionId: options?.sessionId,
    actionType,
    inputData,
    outputData,
    contextUsed: options?.contextUsed,
    accountId: options?.accountId,
    contactId: options?.contactId,
    durationMs: options?.durationMs,
  });
  
  return result.insertId;
}

// Record feedback on an interaction
export async function recordFeedback(
  interactionId: number,
  feedback: 'positive' | 'negative' | 'edited',
  details?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(userInteractions)
    .set({ feedback, feedbackDetails: details })
    .where(eq(userInteractions.id, interactionId));
}

// Save generated content
export async function saveGeneratedContent(
  userId: number,
  contentType: string,
  content: string,
  options?: {
    title?: string;
    accountId?: number;
    contactId?: number;
    ragSourceIds?: number[];
    promptUsed?: string;
  }
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const [result] = await db.insert(generatedContent).values({
    userId,
    contentType,
    content,
    title: options?.title,
    accountId: options?.accountId,
    contactId: options?.contactId,
    ragSourceIds: options?.ragSourceIds,
    promptUsed: options?.promptUsed,
  });
  
  return result.insertId;
}

// Get user's knowledge base documents
export async function getUserDocuments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(knowledgeBase)
    .where(eq(knowledgeBase.userId, userId))
    .orderBy(desc(knowledgeBase.createdAt));
}

// Delete a document and its chunks
export async function deleteDocument(documentId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId));
  await db.delete(knowledgeBase).where(eq(knowledgeBase.id, documentId));
}

// Get learning insights from past interactions
export async function getLearningInsights(
  actionType: string,
  limit: number = 10
): Promise<{ patterns: string[]; improvements: string[] }> {
  const db = await getDb();
  if (!db) return { patterns: [], improvements: [] };
  
  // Get recent interactions with feedback
  const interactions = await db
    .select()
    .from(userInteractions)
    .where(eq(userInteractions.actionType, actionType))
    .orderBy(desc(userInteractions.createdAt))
    .limit(limit);
  
  const positivePatterns: string[] = [];
  const negativePatterns: string[] = [];
  
  for (const interaction of interactions) {
    if (interaction.feedback === 'positive') {
      positivePatterns.push(JSON.stringify(interaction.outputData).slice(0, 200));
    } else if (interaction.feedback === 'negative' || interaction.feedback === 'edited') {
      negativePatterns.push(interaction.feedbackDetails || 'User edited output');
    }
  }
  
  return {
    patterns: positivePatterns.slice(0, 3),
    improvements: negativePatterns.slice(0, 3),
  };
}
