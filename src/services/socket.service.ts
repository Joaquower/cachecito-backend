import { Server, Socket } from 'socket.io';
import { prisma } from './db.service';
import { agentGraph } from '../agents/graph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

const MAX_TURNS = 8;
// Semáforo simple para evitar que dos turnos corran al mismo tiempo en el mismo chat
const activeChats = new Set<string>();

async function triggerAgentTurn(io: Server, chatId: string, userId: string, lastMessage: string, turnCount: number, isInitialHumanMessage: boolean = false) {
  if (turnCount >= MAX_TURNS) {
    io.to(chatId).emit('agentStatus', { status: "Límite de turnos alcanzado. Negociación pausada." });
    activeChats.delete(chatId);
    return;
  }

  // Si no es el mensaje inicial del humano y ya hay alguien procesando, abortamos este disparo redundante
  if (!isInitialHumanMessage && activeChats.has(chatId)) {
    console.log(`Chat ${chatId} busy, skipping redundant trigger`);
    return;
  }

  activeChats.add(chatId);

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      activeChats.delete(chatId);
      return;
    }

    // 1. Detección de saludos simples para no entrar en negociación pesada
    const lowercaseMsg = lastMessage.toLowerCase().trim();
    const isJustGreeting = /^(hola|buenos dias|buenas tardes|saludos|que tal|hi|hello)$/i.test(lowercaseMsg);

    // Si es un saludo y no es el primer turno, paramos el loop
    if (isJustGreeting && turnCount > 0) {
      console.log("Just a greeting, stopping autonomous loop.");
      activeChats.delete(chatId);
      return;
    }

    io.to(chatId).emit('agentStatus', { status: `Agente de ${user.name} analizando...` });

    const rawMessages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      take: 40
    });

    const history = rawMessages.map((m: any) => 
      m.isAi ? new AIMessage(m.content) : new HumanMessage(m.content)
    );

    const initialState = {
      chatId,
      userId,
      userMessage: lastMessage,
      aiPersona: user.aiPersona,
      messages: history,
    };

    const finalState = await agentGraph.invoke(initialState);
    const finalResponse = finalState.negotiatorResponse;

    const aiMessage = await prisma.message.create({
      data: { content: finalResponse, isAi: true, chatId, userId }
    });

    io.to(chatId).emit('newMessage', aiMessage);

    if (finalState.shouldUpdateManifest) {
      io.to(chatId).emit('manifestUpdated', { newContent: finalState.newManifestContent });
    }

    // Liberamos el chat para que el siguiente pueda entrar
    activeChats.delete(chatId);

    // --- Autonomous Loop: Trigger the OTHER agent ---
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { users: true }
    });

    if (chat && chat.users.length > 1 && !isJustGreeting) {
      const otherUser = chat.users.find(u => u.id !== userId);
      if (otherUser) {
        console.log(`Next turn scheduled for: ${otherUser.name}`);
        setTimeout(() => {
          triggerAgentTurn(io, chatId, otherUser.id, finalResponse, turnCount + 1);
        }, 5000);
      }
    }
  } catch (err) {
    console.error("Error in agent turn:", err);
    activeChats.delete(chatId);
  }
}

export function initSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinChat', (chatId: string) => {
      socket.join(chatId);
      console.log(`Socket ${socket.id} joined chat ${chatId}`);
    });

    socket.on('sendMessage', async (data: { chatId: string, userId: string, content: string }) => {
      const { chatId, userId, content } = data;

      try {
        // Bloqueamos el chat para el humano
        if (activeChats.has(chatId)) {
          socket.emit('error', 'Por favor espera a que la negociación termine');
          return;
        }

        // 1. Guardar mensaje humano
        const userMsg = await prisma.message.create({
          data: { content, isAi: false, chatId, userId }
        });
        io.to(chatId).emit('newMessage', userMsg);

        // 2. Iniciar cadena (buscamos al OTRO usuario para que responda al humano)
        const chat = await prisma.chat.findUnique({
          where: { id: chatId },
          include: { users: true }
        });

        if (chat && chat.users.length > 1) {
          const otherUser = chat.users.find(u => u.id !== userId);
          if (otherUser) {
            // El human message dispara el primer turno de la IA contraparte
            await triggerAgentTurn(io, chatId, otherUser.id, content, 0, true);
          }
        }

      } catch (err) {
        console.error(err);
        socket.emit('error', 'Failed to process message');
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
}
