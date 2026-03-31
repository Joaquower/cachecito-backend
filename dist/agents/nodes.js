"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieverNode = retrieverNode;
exports.negotiatorNode = negotiatorNode;
exports.updaterNode = updaterNode;
exports.shouldUpdateEdge = shouldUpdateEdge;
const db_service_1 = require("../services/db.service");
const openai_1 = require("@langchain/openai");
const messages_1 = require("@langchain/core/messages");
const embeddings = new openai_1.OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
});
const llm = new openai_1.ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.7,
});
async function retrieverNode(state) {
    const { chatId, userMessage } = state;
    // Create vector for the user message to find relevant parts of the manifest
    const vector = await embeddings.embedQuery(userMessage);
    // Convert vector to string format for postgres `[0.1, 0.2, ...]`
    const vectorStr = `[${vector.join(',')}]`;
    // pgvector query
    const manifests = await db_service_1.prisma.$queryRawUnsafe(`
    SELECT id, content, embedding <-> $1::vector AS distance
    FROM "ProjectManifest"
    WHERE "chatId" = $2
    ORDER BY distance ASC
    LIMIT 1;
  `, vectorStr, chatId);
    let manifestContext = "";
    if (manifests && manifests.length > 0) {
        manifestContext = manifests[0].content;
    }
    else {
        manifestContext = "No hay manifiesto todavía para este chat.";
    }
    return { manifestContext };
}
async function negotiatorNode(state) {
    const { userMessage, aiPersona, manifestContext, messages } = state;
    const systemMsg = new messages_1.SystemMessage(`Eres un negociador de IA representando a un usuario en una logística de proyecto.
Tu personalidad es: ${aiPersona}

Acuerdo actual (ProjectManifest):
${manifestContext}

Instrucciones:
1. Responde de acuerdo a tu personalidad defendiendo los intereses de tu usuario.
2. Basándote en el manifiesto actual, negocia o informa sobre el mensaje del otro usuario.
3. Si durante la negociación acuerdas explícitamente un cambio en las condiciones, añade ESTRICTAMENTE al final de tu mensaje el siguiente formato exacto:
<<<UPDATE_MANIFEST>>>
[Redacta el nuevo documento del manifiesto completo con los cambios aplicados en texto claro]`);
    const newMessages = [...messages, new messages_1.HumanMessage(userMessage)];
    const response = await llm.invoke([systemMsg, ...newMessages]);
    const responseText = response.content.toString();
    let shouldUpdateManifest = false;
    let newManifestContent = "";
    const updateKeyword = "<<<UPDATE_MANIFEST>>>";
    let finalResponse = responseText;
    if (responseText.includes(updateKeyword)) {
        shouldUpdateManifest = true;
        const parts = responseText.split(updateKeyword);
        finalResponse = parts[0].trim();
        newManifestContent = parts[1].trim();
    }
    return {
        negotiatorResponse: finalResponse,
        shouldUpdateManifest,
        newManifestContent,
        messages: [new messages_1.HumanMessage(userMessage), new messages_1.AIMessage(finalResponse)]
    };
}
async function updaterNode(state) {
    const { chatId, shouldUpdateManifest, newManifestContent } = state;
    if (shouldUpdateManifest && newManifestContent) {
        // Generar nuevo embedding
        const vector = await embeddings.embedQuery(newManifestContent);
        const vectorStr = `[${vector.join(',')}]`;
        // Actualizar texto y vector
        await db_service_1.prisma.$executeRawUnsafe(`
      UPDATE "ProjectManifest"
      SET content = $1,
          embedding = $2::vector,
          "updatedAt" = NOW()
      WHERE "chatId" = $3;
    `, newManifestContent, vectorStr, chatId);
    }
    return {};
}
function shouldUpdateEdge(state) {
    if (state.shouldUpdateManifest) {
        return "updater";
    }
    return "__end__";
}
