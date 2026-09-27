import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { extractFavicon, getGoogleFaviconUrl } from '../utils/favicon';

export const getLinks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { categoryId } = req.query;

    const where: { user_id: string | undefined; category_id?: string } = {
      user_id: req.userId,
    };

    if (categoryId && typeof categoryId === 'string') {
      where.category_id = categoryId;
    }

    const links = await prisma.link.findMany({
      where,
      orderBy: { order_index: 'asc' },
    });

    res.json({ links });
  } catch (error) {
    console.error('Get links error:', error);
    res.status(500).json({ error: 'Failed to get links' });
  }
};

export const createLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, url, categoryId } = req.body;

    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    // 즉시 Google Favicon으로 임시 저장 (빠른 응답)
    const tempFavicon = getGoogleFaviconUrl(url);

    const maxOrder = await prisma.link.findFirst({
      where: { user_id: req.userId },
      orderBy: { order_index: 'desc' },
      select: { order_index: true },
    });

    const link = await prisma.link.create({
      data: {
        user_id: req.userId!,
        title: title || url,
        url,
        favicon_url: tempFavicon,
        category_id: categoryId || null,
        order_index: (maxOrder?.order_index ?? -1) + 1,
      },
    });

    // 백그라운드에서 실제 파비콘 추출 후 업데이트
    extractFavicon(url).then(async (result) => {
      if (result.url && result.source !== 'google') {
        await prisma.link.update({
          where: { id: link.id },
          data: { favicon_url: result.url },
        });
        console.log(`Favicon updated for ${url}: ${result.source}`);
      }
    }).catch((err) => {
      console.error(`Favicon extraction failed for ${url}:`, err);
    });

    res.status(201).json({ link });
  } catch (error) {
    console.error('Create link error:', error);
    res.status(500).json({ error: 'Failed to create link' });
  }
};

export const updateLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, url, categoryId } = req.body;

    const existing = await prisma.link.findFirst({
      where: { id, user_id: req.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }

    // URL이 변경되었을 때 즉시 Google Favicon으로 임시 저장
    let favicon_url = existing.favicon_url;
    const urlChanged = url && url !== existing.url;
    if (urlChanged) {
      favicon_url = getGoogleFaviconUrl(url) || existing.favicon_url;
    }

    const link = await prisma.link.update({
      where: { id },
      data: {
        title,
        url,
        favicon_url,
        category_id: categoryId === '' ? null : categoryId,
      },
    });

    // URL이 변경되었으면 백그라운드에서 실제 파비콘 추출
    if (urlChanged) {
      extractFavicon(url).then(async (result) => {
        if (result.url && result.source !== 'google') {
          await prisma.link.update({
            where: { id },
            data: { favicon_url: result.url },
          });
          console.log(`Favicon updated for ${url}: ${result.source}`);
        }
      }).catch((err) => {
        console.error(`Favicon extraction failed for ${url}:`, err);
      });
    }

    res.json({ link });
  } catch (error) {
    console.error('Update link error:', error);
    res.status(500).json({ error: 'Failed to update link' });
  }
};

export const deleteLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.link.findFirst({
      where: { id, user_id: req.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }

    await prisma.link.delete({ where: { id } });
    res.json({ message: 'Link deleted' });
  } catch (error) {
    console.error('Delete link error:', error);
    res.status(500).json({ error: 'Failed to delete link' });
  }
};

export const reorderLinks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { linkIds } = req.body;

    if (!Array.isArray(linkIds)) {
      res.status(400).json({ error: 'linkIds must be an array' });
      return;
    }

    await Promise.all(
      linkIds.map((id: string, index: number) =>
        prisma.link.updateMany({
          where: { id, user_id: req.userId },
          data: { order_index: index },
        })
      )
    );

    res.json({ message: 'Links reordered' });
  } catch (error) {
    console.error('Reorder links error:', error);
    res.status(500).json({ error: 'Failed to reorder links' });
  }
};

// 특정 링크의 파비콘 갱신
export const refreshFavicon = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.link.findFirst({
      where: { id, user_id: req.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }

    const result = await extractFavicon(existing.url);

    const link = await prisma.link.update({
      where: { id },
      data: { favicon_url: result.url },
    });

    res.json({
      link,
      faviconSource: result.source
    });
  } catch (error) {
    console.error('Refresh favicon error:', error);
    res.status(500).json({ error: 'Failed to refresh favicon' });
  }
};
