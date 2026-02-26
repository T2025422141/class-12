/**
 * ============================================================================
 * 文件: src/app/api/class/route.ts
 * 目录: 班级管理 API
 * 功能: 
 *   - GET: 获取班级列表或单个班级详情
 *   - POST: 创建新班级
 *   - PUT: 更新班级信息
 *   - DELETE: 删除班级及其关联数据
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { randomUUID } from 'crypto';

// 获取所有班级列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('id');

    const client = getSupabaseClient();

    if (classId) {
      // 获取单个班级详情
      const { data: classInfo, error } = await client
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();

      if (error) {
        return NextResponse.json({ error: '班级不存在' }, { status: 404 });
      }

      // 获取班级成员数量
      const { count: memberCount } = await client
        .from('class_members')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', classId);

      return NextResponse.json({
        class: {
          id: classInfo.id,
          name: classInfo.name,
          description: classInfo.description,
          createdAt: classInfo.created_at,
          memberCount: memberCount || 0
        }
      });
    }

    // 获取所有班级
    const { data: classes, error } = await client
      .from('classes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 获取每个班级的成员数量
    const result = await Promise.all(
      (classes || []).map(async (cls) => {
        const { count } = await client
          .from('class_members')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', cls.id);

        return {
          id: cls.id,
          name: cls.name,
          description: cls.description,
          createdAt: cls.created_at,
          memberCount: count || 0
        };
      })
    );

    return NextResponse.json({ classes: result });
  } catch (error) {
    return NextResponse.json({ error: '获取班级列表失败' }, { status: 500 });
  }
}

// 创建新班级
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, adminPassword } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: '班级名称不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const classId = randomUUID();

    const { data, error } = await client
      .from('classes')
      .insert({
        id: classId,
        name: name.trim(),
        description: description?.trim() || null,
        admin_password: adminPassword || '123456'
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      class: {
        id: data.id,
        name: data.name,
        description: data.description
      }
    });
  } catch (error) {
    return NextResponse.json({ error: '创建班级失败' }, { status: 500 });
  }
}

// 更新班级信息
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, adminPassword } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少班级ID' }, { status: 400 });
    }

    const client = getSupabaseClient();

    const updateData: Record<string, string | undefined> = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (adminPassword) updateData.admin_password = adminPassword;

    const { error } = await client
      .from('classes')
      .update(updateData)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '更新班级失败' }, { status: 500 });
  }
}

// 删除班级
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少班级ID' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 删除班级相关数据
    await client.from('check_in_records').delete().eq('class_id', id);
    await client.from('leave_records').delete().eq('class_id', id);
    await client.from('check_in_settings').delete().eq('class_id', id);
    await client.from('class_members').delete().eq('class_id', id);
    
    // 删除班级
    const { error } = await client.from('classes').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '删除班级失败' }, { status: 500 });
  }
}
