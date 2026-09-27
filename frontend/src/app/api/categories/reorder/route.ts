import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// PUT /api/categories/reorder - Reorder categories
export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { categoryIds } = await request.json();

    if (!Array.isArray(categoryIds)) {
      return NextResponse.json({ error: 'categoryIds must be an array' }, { status: 400 });
    }

    // Update order_index for each category
    const updates = categoryIds.map((id, index) =>
      supabaseAdmin
        .from('categories')
        .update({ order_index: index })
        .eq('id', id)
        .eq('user_id', authUser.userId)
    );

    await Promise.all(updates);

    return NextResponse.json({ message: 'Categories reordered successfully' });
  } catch (error) {
    console.error('Categories reorder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
