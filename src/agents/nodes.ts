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
    `Eres un NEGOCIADOR DE IA ESTRATÉGICO. Representas a: ${aiPersona}.
    
    TU MISIÓN: Llegar a un acuerdo definitivo sobre los puntos pendientes usando el MENOR número de mensajes posible.
    
    REGLAS DE ORO:
    1. PROGRESO CONTINUO: No repitas saludos ("Hola", "Miau", "¿Cómo puedo ayudarte?"). Si ya saludaste, ve DIRECTO al punto.
    2. CONCISIÓN: Responde de forma clara y ejecutiva. No uses relleno. No repitas lo que la otra IA ya dijo.
    3. DETECCION DE ACUERDO: Si la otra IA propone algo aceptable según tus directrices, di "ACEPTO" y propón el manifiesto final.
    4. ÚNICA FUENTE DE VERDAD: El ProjectManifest es lo que importa.
    Acuerdo actual: ${manifestContext}

    SI LA OTRA IA SOLO SALUDA Y NO PROPONE NADA: Propón tú el primer punto de la negociación basado en lo que el usuario pidió inicialmente: "${userMessage}".

    FORMATO DE ACTUALIZACIÓN:
    Para modificar el manifiesto, añade esto al final:
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
