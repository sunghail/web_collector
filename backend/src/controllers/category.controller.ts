import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getCategories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      where: { user_id: req.userId },
      orderBy: { order_index: 'asc' },
    });
    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
};

export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, color } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const maxOrder = await prisma.category.findFirst({
      where: { user_id: req.userId },
      orderBy: { order_index: 'desc' },
      select: { order_index: true },
    });

    const category = await prisma.category.create({
      data: {
        user_id: req.userId!,
        name,
        color: color || '#3B82F6',
        order_index: (maxOrder?.order_index ?? -1) + 1,
      },
    });

    res.status(201).json({ category });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    const existing = await prisma.category.findFirst({
      where: { id, user_id: req.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const category = await prisma.category.update({
      where: { id },
      data: { name, color },
    });

    res.json({ category });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.category.findFirst({
      where: { id, user_id: req.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    await prisma.category.delete({ where: { id } });
    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

export const reorderCategories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { categoryIds } = req.body;

    if (!Array.isArray(categoryIds)) {
      res.status(400).json({ error: 'categoryIds must be an array' });
      return;
    }

    await Promise.all(
      categoryIds.map((id: string, index: number) =>
        prisma.category.updateMany({
          where: { id, user_id: req.userId },
          data: { order_index: index },
        })
      )
    );

    res.json({ message: 'Categories reordered' });
  } catch (error) {
    console.error('Reorder categories error:', error);
    res.status(500).json({ error: 'Failed to reorder categories' });
  }
};
