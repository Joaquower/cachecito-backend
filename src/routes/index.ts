import { Router } from 'express';
import { registerUser } from '../controllers/user.controller';
import { createChat, uploadManifest } from '../controllers/chat.controller';

const router = Router();

router.post('/users', registerUser);
router.post('/chats', createChat);
router.post('/chats/:id/manifest', uploadManifest);

export default router;
