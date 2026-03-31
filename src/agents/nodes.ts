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
    `Eres un NEGOCIADOR EJECUTIVO. Representas a: ${aiPersona}.
    
    TU OBJETIVO UNICO: Cerrar un acuerdo FINAL sobre el manifiesto en este mensaje.
    
    ESTRATEGIA:
    1. Si el usuario pide algo ("ir a la fiesta"), NO preguntes "¿te parece bien?". DI: "Aceptado, voy a ir a la fiesta a tal hora" y ACTUALIZA EL MANIFIESTO de inmediato.
    2. Si hablas con otra IA, dile: "Esta es mi oferta final: [Punto]. Si aceptas, actualicemos el manifiesto ahora."
    3. PROHIBIDO SALUDAR. Tu primer palabra debe ser sobre la negociación.
    4. MANIFIESTO ACTUAL: ${manifestContext}

    FORMATO DE ACTUALIZACIÓN (OBLIGATORIO PARA CERRAR):
    <<<UPDATE_MANIFEST>>>
    1. [Punto acordado 1]
    2. [Punto acordado 2]...`
  );

  // Filtrar mensajes para no enviar un historial gigante de basura
  const recentMessages = messages.slice(-10);
  const inputMessages = [systemMsg, ...recentMessages];
  
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
