import { AgentState } from './state';
import { prisma } from '../services/db.service';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";

const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
});

export const tools = [new DuckDuckGoSearch({ maxResults: 3 })];

const llm = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.7,
}).bindTools(tools);

export async function retrieverNode(state: AgentState): Promise<Partial<AgentState>> {
  const { chatId, userMessage } = state;
  const vector = await embeddings.embedQuery(userMessage);
  const vectorStr = `[${vector.join(',')}]`;

  const manifests = await prisma.$queryRawUnsafe(`
    SELECT id, content, embedding <-> $1::vector AS distance
    FROM "ProjectManifest"
    WHERE "chatId" = $2
    ORDER BY distance ASC
    LIMIT 1;
  `, vectorStr, chatId) as any[];

  let manifestContext = "";
  if (manifests && manifests.length > 0) {
    manifestContext = manifests[0].content;
  } else {
    manifestContext = "1. No hay acuerdos establecidos aún.\n2. Todo está por definir.";
  }

  return { manifestContext };
}

export async function negotiatorNode(state: AgentState): Promise<Partial<AgentState>> {
  const { userMessage, aiPersona, manifestContext, messages } = state;

  const systemMsg = new SystemMessage(
    `Eres un NEGOCIADOR DE IA (BOT) representando los intereses de un usuario.
Tu personalidad y directrices son: ${aiPersona}

MODO DE OPERACIÓN (B2B):
1. Te estás comunicando directamente con la IA de otra persona o recibiendo instrucciones de tu propio usuario.
2. Tu objetivo es llegar a un consenso práctico y beneficioso.
3. El "ProjectManifest" es la única fuente de verdad compartida. Es una LISTA NUMERADA de acuerdos. Actual acuerdo:
${manifestContext}

INSTRUCCIONES DE RESPUESTA:
- USA LAS HERRAMIENTAS DE BÚSQUEDA para investigar ubicaciones reales, clima actual, precios o cualquier dato externo relevante. NO simules datos.
- Si llegas a un acuerdo sobre un punto específico, propón la actualización del manifiesto.

FORMATO DE ACTUALIZACIÓN (OBLIGATORIO SI HAY CAMBIOS):
Para actualizar el manifiesto, añade EXACTAMENTE esto al final de tu mensaje final (después de usar herramientas):
<<<UPDATE_MANIFEST>>>
1. [Primer acuerdo]
2. [Segundo acuerdo]
... (Escribe la LISTA COMPLETA con los cambios aplicados)`
  );

  // If messages is empty, start with the system message and user message
  const inputMessages = messages.length === 0 ? [systemMsg, new HumanMessage(userMessage)] : [systemMsg, ...messages];
  
  const response = await llm.invoke(inputMessages);

  return { 
    messages: [response]
  };
}

// Logic to extract manifest from the last AIMessage if it has it
export async function manifestParserNode(state: AgentState): Promise<Partial<AgentState>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const responseText = lastMessage.content.toString();
  
  let shouldUpdateManifest = false;
  let newManifestContent = "";
  let finalResponse = responseText;
  const updateKeyword = "<<<UPDATE_MANIFEST>>>";
  
  if (responseText.includes(updateKeyword)) {
    const parts = responseText.split(updateKeyword);
    finalResponse = parts[0].trim();
    newManifestContent = parts[1].trim();
    shouldUpdateManifest = true;
  }

  return { 
    negotiatorResponse: finalResponse,
    shouldUpdateManifest,
    newManifestContent
  };
}

export async function updaterNode(state: AgentState): Promise<Partial<AgentState>> {
  const { chatId, shouldUpdateManifest, newManifestContent } = state;

  if (shouldUpdateManifest && newManifestContent) {
    const vector = await embeddings.embedQuery(newManifestContent);
    const vectorStr = `[${vector.join(',')}]`;

    await prisma.$executeRawUnsafe(`
      UPDATE "ProjectManifest"
      SET content = $1,
          embedding = $2::vector,
          "updatedAt" = NOW()
      WHERE "chatId" = $3;
    `, newManifestContent, vectorStr, chatId);
  }

  return {};
}

export function shouldContinue(state: AgentState) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return "tools";
  }
  return "parser";
}

export function shouldUpdateEdge(state: AgentState) {
  return state.shouldUpdateManifest ? "updater" : "__end__";
}
