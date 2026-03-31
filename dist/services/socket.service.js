"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
const db_service_1 = require("./db.service");
const graph_1 = require("../agents/graph");
const messages_1 = require("@langchain/core/messages");
function initSocket(io) {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);
        socket.on('joinChat', (chatId) => {
            socket.join(chatId);
            console.log(`Socket ${socket.id} joined chat ${chatId}`);
        });
        socket.on('sendMessage', async (data) => {
            const { chatId, userId, content } = data;
            try {
                io.to(chatId).emit('newMessage', { chatId, userId, content, isAi: false });
                await db_service_1.prisma.message.create({
                    data: { content, isAi: false, chatId, userId }
                });
                const user = await db_service_1.prisma.user.findUnique({ where: { id: userId } });
                if (!user)
                    return;
                io.to(chatId).emit('agentStatus', { status: "Agente analizando contexto..." });
                const rawMessages = await db_service_1.prisma.message.findMany({
                    where: { chatId },
                    orderBy: { createdAt: 'asc' },
                    take: 20
                });
                const history = rawMessages.map((m) => m.isAi ? new messages_1.AIMessage(m.content) : new messages_1.HumanMessage(m.content));
                const initialState = {
                    chatId,
                    userId,
                    userMessage: content,
                    aiPersona: user.aiPersona,
                    messages: history,
                };
                io.to(chatId).emit('agentStatus', { status: "Negociando..." });
                const finalState = await graph_1.agentGraph.invoke(initialState);
                const finalResponse = finalState.negotiatorResponse;
                io.to(chatId).emit('agentStatus', { status: "Respuesta lista" });
                const aiMessage = await db_service_1.prisma.message.create({
                    data: { content: finalResponse, isAi: true, chatId, userId }
                });
                io.to(chatId).emit('newMessage', aiMessage);
                if (finalState.shouldUpdateManifest) {
                    io.to(chatId).emit('manifestUpdated', { newContent: finalState.newManifestContent });
                }
            }
            catch (err) {
                console.error(err);
                socket.emit('error', 'Failed to process message');
            }
        });
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });
}
