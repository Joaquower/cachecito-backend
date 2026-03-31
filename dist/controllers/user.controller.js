"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
const db_service_1 = require("../services/db.service");
async function registerUser(req, res) {
    try {
        const { name, aiPersona } = req.body;
        const user = await db_service_1.prisma.user.create({
            data: { name, aiPersona }
        });
        res.status(201).json(user);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
}
