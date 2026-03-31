import { Router } from 'express';
import { registerUser, getAllUsers, getUserChats } from '../controllers/user.controller';
import { createChat, uploadManifest, getChatDetail } from '../controllers/chat.controller';

const router = Router();

router.post('/users', registerUser);
router.get('/users', getAllUsers);
router.get('/users/:id/chats', getUserChats);
router.post('/chats', createChat);
router.get('/chats/:id', getChatDetail);
router.post('/chats/:id/manifest', uploadManifest);

export default router;
