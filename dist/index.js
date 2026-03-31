"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
const socket_service_1 = require("./services/socket.service");
const db_service_1 = require("./services/db.service");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: { origin: '*' }
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api', routes_1.default);
(0, socket_service_1.initSocket)(io);
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    await (0, db_service_1.initDb)();
});
