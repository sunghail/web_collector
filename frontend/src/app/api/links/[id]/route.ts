import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeFallbackFaviconDataUrl } from '@/lib/fallbackFavicons';
import { normalizeUrlForDuplicate } from '@/lib/linkUtils';

async function findDuplicateLink(userId: string, url: string, excludeId: string) {
  const targetUrl = normalizeUrlForDuplicate(url);
  if (!targetUrl) return null;

  const { data: existingLinks, error } = await supabaseAdmin
    .from('links')
    .select('id, title, url, category_id')
    .eq('user_id', userId)
    .eq('type', 'link');

  if (error) {
    console.error('Error checking duplicate link:', error);
    return null;
  }

  return (
    existingLinks?.find(
      (link: { id: string; url: string }) =>
        link.id !== excludeId && normalizeUrlForDuplicate(link.url) === targetUrl
    ) || null
  );
}

// PUT /api/links/[id] - Update a link or macro
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const {
      title,
      url,
      categoryId,
      memo,
      showFavicon,
      favicon: selectedFavicon,
      macroItems,
    } = await request.json();
    const normalizedSelectedFavicon = normalizeFallbackFaviconDataUrl(selectedFavicon);

    // Verify ownership
    const { data: existingLink } = await supabaseAdmin
      .from('links')
      .select('id, type')
      .eq('id', id)
      .eq('user_id', authUser.userId)
      .single();

    if (!existingLink) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (url !== undefined) {
      if (existingLink.type !== 'macro') {
        const duplicateLink = await findDuplicateLink(authUser.userId, url, id);
        if (duplicateLink) {
          return NextResponse.json(
            {
              error: 'Duplicate link',
              duplicate: duplicateLink,
            },
            { status: 409 }
          );
        }
      }

      updateData.url = url;
      // Update favicon if URL changed
      try {
        const urlObj = new URL(url);
        updateData.favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
      } catch {
        // Invalid URL, skip favicon update
      }
    }
    if (categoryId !== undefined) updateData.category_id = categoryId || null;
    if (memo !== undefined) updateData.memo = memo === '' ? null : memo;
    if (showFavicon !== undefined) updateData.show_favicon = showFavicon;
    if (selectedFavicon !== undefined) updateData.favicon = normalizedSelectedFavicon || null;

    const { data: link, error } = await supabaseAdmin
      .from('links')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating link:', error);
      return NextResponse.json({ error: 'Failed to update link' }, { status: 500 });
    }

    // Handle macro items update (delete & reinsert)
    if (macroItems !== undefined && existingLink.type === 'macro') {
      // Delete existing items
      await supabaseAdmin
        .from('macro_items')
        .delete()
        .eq('macro_id', id);

      // Insert new items
      if (macroItems.length > 0) {
        const itemsToInsert = macroItems.map((item: { link_id?: string; custom_url?: string; custom_title?: string; order_index: number }) => {
          let customFavicon = null;
          if (item.custom_url) {
            try {
              const urlObj = new URL(item.custom_url);
              customFavicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
            } catch {
              // Invalid URL
            }
          }
          return {
            macro_id: id,
            link_id: item.link_id || null,
            custom_url: item.custom_url || null,
            custom_title: item.custom_title || null,
            custom_favicon: customFavicon,
            order_index: item.order_index,
          };
        });

        const { data: insertedItems, error: itemsError } = await supabaseAdmin
          .from('macro_items')
          .insert(itemsToInsert)
          .select('*');

        if (itemsError) {
          console.error('Error updating macro items:', itemsError);
        }

        // Resolve items for response
        const linkedIds = (insertedItems || [])
          .filter((i: { link_id: string | null }) => i.link_id)
          .map((i: { link_id: string }) => i.link_id);

        let linkedMap: Record<string, { url: string; title: string; favicon: string | null }> = {};
        if (linkedIds.length > 0) {
          const { data: linkedLinks } = await supabaseAdmin
            .from('links')
            .select('id, url, title, favicon')
            .in('id', linkedIds);
          if (linkedLinks) {
            linkedMap = Object.fromEntries(
              linkedLinks.map((l: { id: string; url: string; title: string; favicon: string | null }) => [l.id, l])
            );
          }
        }

        const resolvedItems = (insertedItems || []).map((item: {
          link_id: string | null;
          custom_url: string | null;
          custom_title: string | null;
          custom_favicon: string | null;
          [key: string]: unknown;
        }) => {
          const linked = item.link_id ? linkedMap[item.link_id as string] : null;
          return {
            ...item,
            resolved_url: linked?.url || item.custom_url,
            resolved_title: linked?.title || item.custom_title,
            resolved_favicon: linked?.favicon || item.custom_favicon,
          };
        });

        return NextResponse.json({ link: { ...link, macro_items: resolvedItems } });
      }

      return NextResponse.json({ link: { ...link, macro_items: [] } });
    }

    return NextResponse.json({ link });
  } catch (error) {
    console.error('Link PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/links/[id] - Delete a link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const { data: existingLink } = await supabaseAdmin
      .from('links')
      .select('id')
      .eq('id', id)
      .eq('user_id', authUser.userId)
      .single();

    if (!existingLink) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from('links')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting link:', error);
      return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Link deleted successfully' });
  } catch (error) {
    console.error('Link DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
