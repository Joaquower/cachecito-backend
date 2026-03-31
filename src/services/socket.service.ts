import { Server, Socket } from 'socket.io';
import { prisma } from './db.service';
import { agentGraph } from '../agents/graph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

const MAX_TURNS = 6;

async function triggerAgentTurn(io: Server, chatId: string, userId: string, lastMessage: string, turnCount: number) {
  if (turnCount >= MAX_TURNS) {
    io.to(chatId).emit('agentStatus', { status: "Límite de turnos alcanzado. Negociación pausada." });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    // 1. Obtener historial para ver quién envió el último mensaje real
    const lastMsgs = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      take: 2
    });

    // Si el último mensaje YA fue de este mismo usuario/IA, no respondemos otra vez (evita loops)
    if (lastMsgs.length > 0 && lastMsgs[0].userId === userId && lastMsgs[0].isAi) {
      console.log(`Aborting turn for ${user.name} to prevent same-agent loop`);
      return;
    }

    io.to(chatId).emit('agentStatus', { status: `Agente de ${user.name} analizando...` });

    const rawMessages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      take: 30
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

    // 2. Guardar mensaje de la IA con SU ID de usuario para saber quién habló
    const aiMessage = await prisma.message.create({
      data: { content: finalResponse, isAi: true, chatId, userId }
    });

    io.to(chatId).emit('newMessage', aiMessage);

    if (finalState.shouldUpdateManifest) {
      io.to(chatId).emit('manifestUpdated', { newContent: finalState.newManifestContent });
    }

    // --- Autonomous Loop: Trigger the OTHER agent ---
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { users: true }
    });

    if (chat && chat.users.length > 1) {
      const otherUser = chat.users.find(u => u.id !== userId);
      if (otherUser) {
        console.log(`Scheduling next turn for: ${otherUser.name}`);
        // Delay más largo para evitar colisiones y dar realismo
        setTimeout(() => {
          triggerAgentTurn(io, chatId, otherUser.id, finalResponse, turnCount + 1);
        }, 6000);
      }
    }
  } catch (err) {
    console.error("Error in agent turn:", err);
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
        // 1. Save and emit user message
        const userMsg = await prisma.message.create({
          data: { content, isAi: false, chatId, userId }
        });
        io.to(chatId).emit('newMessage', userMsg);

        // 2. Start the autonomous turn-based negotiation
        await triggerAgentTurn(io, chatId, userId, content, 0);

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
