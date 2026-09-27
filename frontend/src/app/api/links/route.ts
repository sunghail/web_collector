import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeFallbackFaviconDataUrl } from '@/lib/fallbackFavicons';
import { INBOX_CATEGORY_ID, normalizeUrlForDuplicate } from '@/lib/linkUtils';

async function findDuplicateLink(userId: string, url: string) {
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
    existingLinks?.find((link: { url: string }) => normalizeUrlForDuplicate(link.url) === targetUrl) || null
  );
}

// GET /api/links - Get all links for user
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    let query = supabaseAdmin
      .from('links')
      .select('*')
      .eq('user_id', authUser.userId)
      .order('order_index', { ascending: true });

    if (categoryId === INBOX_CATEGORY_ID) {
      query = query.is('category_id', null);
    } else if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data: links, error } = await query;

    if (error) {
      console.error('Error fetching links:', error);
      return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
    }

    // Attach macro_items for macro-type links
    const macroLinks = (links || []).filter((l: { type?: string }) => l.type === 'macro');

    if (macroLinks.length > 0) {
      const macroIds = macroLinks.map((l: { id: string }) => l.id);

      const { data: macroItems } = await supabaseAdmin
        .from('macro_items')
        .select('*')
        .in('macro_id', macroIds)
        .order('order_index', { ascending: true });

      // Resolve link_id references
      const linkedItemIds = (macroItems || [])
        .filter((item: { link_id: string | null }) => item.link_id)
        .map((item: { link_id: string }) => item.link_id);

      let linkedLinksMap: Record<string, { url: string; title: string; favicon: string | null }> = {};
      if (linkedItemIds.length > 0) {
        const { data: linkedLinks } = await supabaseAdmin
          .from('links')
          .select('id, url, title, favicon')
          .in('id', linkedItemIds);

        if (linkedLinks) {
          linkedLinksMap = Object.fromEntries(
            linkedLinks.map((l: { id: string; url: string; title: string; favicon: string | null }) => [l.id, l])
          );
        }
      }

      // Group macro_items by macro_id and resolve
      const itemsByMacro: Record<string, unknown[]> = {};
      (macroItems || []).forEach((item: {
        macro_id: string;
        link_id: string | null;
        custom_url: string | null;
        custom_title: string | null;
        custom_favicon: string | null;
        [key: string]: unknown;
      }) => {
        if (!itemsByMacro[item.macro_id]) itemsByMacro[item.macro_id] = [];

        const linked = item.link_id ? linkedLinksMap[item.link_id] : null;
        itemsByMacro[item.macro_id].push({
          ...item,
          resolved_url: linked?.url || item.custom_url,
          resolved_title: linked?.title || item.custom_title,
          resolved_favicon: linked?.favicon || item.custom_favicon,
        });
      });

      // Attach to links
      (links || []).forEach((link: { id: string; type?: string; macro_items?: unknown[] }) => {
        if (link.type === 'macro') {
          link.macro_items = itemsByMacro[link.id] || [];
        }
      });
    }

    return NextResponse.json({ links });
  } catch (error) {
    console.error('Links GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/links - Create a new link or macro
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      title,
      url,
      categoryId,
      memo,
      showFavicon,
      favicon: selectedFavicon,
      type,
      macroItems,
    } = await request.json();
    const normalizedSelectedFavicon = normalizeFallbackFaviconDataUrl(selectedFavicon);

    // Macro creation
    if (type === 'macro') {
      if (!title) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
      }
      if (!macroItems || macroItems.length === 0) {
        return NextResponse.json({ error: 'At least one macro item is required' }, { status: 400 });
      }

      // Get max order_index
      const { data: maxOrderData } = await supabaseAdmin
        .from('links')
        .select('order_index')
        .eq('user_id', authUser.userId)
        .order('order_index', { ascending: false })
        .limit(1)
        .single();

      const newOrderIndex = (maxOrderData?.order_index ?? -1) + 1;

      // Insert macro as a link row
      const { data: macroLink, error: macroError } = await supabaseAdmin
        .from('links')
        .insert({
          user_id: authUser.userId,
          category_id: categoryId || null,
          title,
          url: 'macro://',
          favicon: null,
          show_favicon: true,
          memo: memo || null,
          type: 'macro',
          order_index: newOrderIndex,
        })
        .select('*')
        .single();

      if (macroError || !macroLink) {
        console.error('Error creating macro:', macroError);
        return NextResponse.json({ error: 'Failed to create macro' }, { status: 500 });
      }

      // Insert macro items
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
          macro_id: macroLink.id,
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
        console.error('Error creating macro items:', itemsError);
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

      return NextResponse.json({
        link: { ...macroLink, macro_items: resolvedItems },
      }, { status: 201 });
    }

    // Normal link creation
    if (!title || !url) {
      return NextResponse.json({ error: 'Title and URL are required' }, { status: 400 });
    }

    const duplicateLink = await findDuplicateLink(authUser.userId, url);
    if (duplicateLink) {
      return NextResponse.json(
        {
          error: 'Duplicate link',
          duplicate: duplicateLink,
        },
        { status: 409 }
      );
    }

    // Extract favicon URL
    let favicon = null;
    try {
      const urlObj = new URL(url);
      favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
    } catch {
      // Invalid URL, skip favicon
    }

    // Get max order_index for new link
    const { data: maxOrderData } = await supabaseAdmin
      .from('links')
      .select('order_index')
      .eq('user_id', authUser.userId)
      .order('order_index', { ascending: false })
      .limit(1)
      .single();

    const newOrderIndex = (maxOrderData?.order_index ?? -1) + 1;

    const { data: link, error } = await supabaseAdmin
      .from('links')
      .insert({
        user_id: authUser.userId,
        category_id: categoryId || null,
        title,
        url,
        favicon: normalizedSelectedFavicon || favicon,
        show_favicon: showFavicon !== undefined ? showFavicon : true,
        memo: memo || null,
        order_index: newOrderIndex,
        type: 'link',
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating link:', error);
      return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
    }

    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    console.error('Links POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
