/**
 * ============================================================================
 * 文件: src/app/api/class/members/route.ts
 * 目录: 班级成员 API
 * 功能: 
 *   - GET: 获取成员列表
 *   - POST: 批量导入成员
 *   - DELETE: 删除成员（支持单个/批量/全部）
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取成员列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');

    const client = getSupabaseClient();
    
    let query = client
      .from('class_members')
      .select('*')
      .order('created_at', { ascending: true });

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ members: data });
  } catch (error) {
    return NextResponse.json({ error: '获取成员列表失败' }, { status: 500 });
  }
}

// 批量导入成员
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { names, classId } = body;

    if (!names || !Array.isArray(names) || names.length === 0) {
      return NextResponse.json({ error: '请提供有效的名单' }, { status: 400 });
    }

    if (!classId) {
      return NextResponse.json({ error: '缺少班级ID' }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    // 批量插入新成员
    const membersToInsert = names.map(name => ({ 
      name: name.trim(),
      class_id: classId
    }));
    
    const { data, error } = await client
      .from('class_members')
      .insert(membersToInsert)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      count: data?.length || 0,
      members: data 
    });
  } catch (error) {
    return NextResponse.json({ error: '导入成员失败' }, { status: 500 });
  }
}

// 删除成员（支持单个删除、批量删除、全部清除）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classIdFromQuery = searchParams.get('classId');
    const memberId = searchParams.get('memberId');

    // 优先通过请求体获取参数
    let body: { memberIds?: string[]; classId?: string; clearAll?: boolean } = {};
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      try {
        body = await request.json();
      } catch (e) {
        console.error('解析请求体失败:', e);
      }
    }

    const client = getSupabaseClient();
    const targetClassId = body.classId || classIdFromQuery;
    
    // 批量删除指定的成员（直接按ID删除，不需要class_id过滤）
    if (body.memberIds && body.memberIds.length > 0) {
      const { data, error } = await client
        .from('class_members')
        .delete()
        .in('id', body.memberIds)
        .select();
      
      if (error) {
        console.error('批量删除失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, count: data?.length || 0 });
    }
    
    // 全部清除
    if (body.clearAll && targetClassId) {
      const { data, error } = await client
        .from('class_members')
        .delete()
        .eq('class_id', targetClassId)
        .select();
      
      if (error) {
        console.error('全部清除失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, count: data?.length || 0 });
    }
    
    // 删除单个成员（通过URL参数）
    if (memberId) {
      const { error } = await client
        .from('class_members')
        .delete()
        .eq('id', memberId);
      
      if (error) {
        console.error('单个删除失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, count: 1 });
    }
    
    // 删除该班级所有成员（通过URL参数）
    if (classIdFromQuery) {
      const { data, error } = await client
        .from('class_members')
        .delete()
        .eq('class_id', classIdFromQuery)
        .select();
      
      if (error) {
        console.error('按班级删除失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, count: data?.length || 0 });
    }

    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  } catch (error) {
    console.error('删除成员失败:', error);
    return NextResponse.json({ error: '删除成员失败' }, { status: 500 });
  }
}
