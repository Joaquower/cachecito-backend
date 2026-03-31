import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import routes from './routes';
import { initSocket } from './services/socket.service';
import { initDb } from './services/db.service';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

app.use('/api', routes);

initSocket(io);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await initDb();
});
