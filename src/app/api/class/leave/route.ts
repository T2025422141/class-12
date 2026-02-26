/**
 * ============================================================================
 * 文件: src/app/api/class/leave/route.ts
 * 目录: 请假记录 API
 * 功能: 
 *   - POST: 创建请假记录（支持日期范围/固定星期）
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 创建请假记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { memberId, classId, leaveType, startDate, endDate, weekdays, period, reason, imageUrl } = body;

    if (!memberId || !classId || !leaveType) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 验证请假类型
    if (leaveType === 'date_range' && (!startDate || !endDate)) {
      return NextResponse.json({ error: '日期范围请假需要填写开始和结束日期' }, { status: 400 });
    }

    if (leaveType === 'weekdays' && !weekdays) {
      return NextResponse.json({ error: '固定星期几请假需要选择星期' }, { status: 400 });
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from('leave_records')
      .insert({
        member_id: memberId,
        class_id: classId,
        leave_type: leaveType,
        start_date: leaveType === 'date_range' ? startDate : null,
        end_date: leaveType === 'date_range' ? endDate : null,
        weekdays: leaveType === 'weekdays' ? weekdays : null,
        period: period || 'all',
        reason: reason || '', // 原因可选，默认为空字符串
        image_url: imageUrl || null,
        is_active: '1'
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, record: data });
  } catch (error) {
    return NextResponse.json({ error: '创建请假记录失败' }, { status: 500 });
  }
}
