/**
 * ============================================================================
 * 文件: src/app/api/class/settings/route.ts
 * 目录: 签到设置 API
 * 功能: 
 *   - GET: 获取班级签到设置（时间限制、位置信息）
 *   - POST: 更新签到设置
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取设置
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');

    if (!classId) {
      return NextResponse.json({ 
        settings: {
          morning_limit_time: '09:00',
          evening_limit_time: '18:00',
          admin_password: '123456',
          target_latitude: null,
          target_longitude: null,
          distance_limit: 100
        }
      });
    }

    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('check_in_settings')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 如果没有设置，返回默认值
    const settings = data || {
      morning_limit_time: '09:00',
      evening_limit_time: '18:00',
      admin_password: '123456',
      target_latitude: null,
      target_longitude: null,
      distance_limit: 100,
      temp_checkin_enabled: false
    };

    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: '获取设置失败' }, { status: 500 });
  }
}

// 更新设置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      classId, 
      morningLimitTime, 
      eveningLimitTime, 
      adminPassword,
      targetLatitude,
      targetLongitude,
      distanceLimit,
      tempCheckinEnabled
    } = body;

    if (!classId) {
      return NextResponse.json({ error: '缺少班级ID' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 检查是否已存在设置
    const { data: existing } = await client
      .from('check_in_settings')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let result;
    if (existing) {
      // 更新
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      if (morningLimitTime !== undefined) updateData.morning_limit_time = morningLimitTime;
      if (eveningLimitTime !== undefined) updateData.evening_limit_time = eveningLimitTime;
      if (adminPassword !== undefined) updateData.admin_password = adminPassword;
      if (targetLatitude !== undefined) updateData.target_latitude = targetLatitude;
      if (targetLongitude !== undefined) updateData.target_longitude = targetLongitude;
      if (distanceLimit !== undefined) updateData.distance_limit = distanceLimit;
      if (tempCheckinEnabled !== undefined) updateData.temp_checkin_enabled = tempCheckinEnabled;
      
      const { data, error } = await client
        .from('check_in_settings')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    } else {
      // 创建
      const { data, error } = await client
        .from('check_in_settings')
        .insert({
          class_id: classId,
          date: new Date().toISOString().split('T')[0],
          morning_limit_time: morningLimitTime || '09:00',
          evening_limit_time: eveningLimitTime || '18:00',
          admin_password: adminPassword || '123456',
          target_latitude: targetLatitude || null,
          target_longitude: targetLongitude || null,
          distance_limit: distanceLimit || 100,
          temp_checkin_enabled: tempCheckinEnabled || false
        })
        .select()
        .single();
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({ success: true, settings: result });
  } catch (error) {
    return NextResponse.json({ error: '更新设置失败' }, { status: 500 });
  }
}
