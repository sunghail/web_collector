import { Router } from 'express';
import {
  getLinks,
  createLink,
  updateLink,
  deleteLink,
  reorderLinks,
  refreshFavicon,
} from '../controllers/link.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/links
router.get('/', getLinks);

// POST /api/links
router.post('/', createLink);

// PUT /api/links/reorder (must be before /:id)
router.put('/reorder', reorderLinks);

// POST /api/links/:id/refresh-favicon
router.post('/:id/refresh-favicon', refreshFavicon);

// PUT /api/links/:id
router.put('/:id', updateLink);

// DELETE /api/links/:id
router.delete('/:id', deleteLink);

export default router;
