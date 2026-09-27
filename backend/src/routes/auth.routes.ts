import { Router } from 'express';
import { register, login, logout, me, updateTheme } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/logout
router.post('/logout', logout);

// GET /api/auth/me
router.get('/me', authMiddleware, me);

// PUT /api/auth/theme
router.put('/theme', authMiddleware, updateTheme);

export default router;
