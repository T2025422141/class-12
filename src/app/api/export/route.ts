import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 获取导出数据
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const classId = searchParams.get('classId');

    if (!classId) {
      return NextResponse.json({ error: '缺少班级ID' }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    // 获取成员信息
    const { data: members } = await client
      .from('class_members')
      .select('id, name')
      .eq('class_id', classId);

    const memberMap = new Map();
    members?.forEach(m => memberMap.set(m.id, m.name));

    // 获取当日签到记录
    const { data: records } = await client
      .from('check_in_records')
      .select('*')
      .eq('date', date)
      .eq('class_id', classId);

    // 获取所有有效的请假记录
    const { data: leaveRecords } = await client
      .from('leave_records')
      .select('*')
      .eq('is_active', '1')
      .eq('class_id', classId);

    // 过滤出当前日期有效的请假记录
    const currentDate = new Date(date);
    const currentWeekday = currentDate.getDay();

    const validLeaveRecords: Array<{
      name: string;
      reason: string;
      imageUrl: string | null;
      leaveType: string;
      startDate: string | null;
      endDate: string | null;
      weekdays: string | null;
      period: string;
    }> = [];

    leaveRecords?.forEach(record => {
      let isValid = false;
      
      if (record.leave_type === 'date_range') {
        const start = record.start_date;
        const end = record.end_date;
        isValid = date >= start! && date <= end!;
      } else if (record.leave_type === 'weekdays') {
        const weekdays = record.weekdays?.split(',').map((w: string) => parseInt(w)) || [];
        isValid = weekdays.includes(currentWeekday);
      }

      if (isValid) {
        const name = memberMap.get(record.member_id) || '未知';
        const periodLabel = record.period === 'morning' ? '早签' 
          : record.period === 'evening' ? '晚签' 
          : '全天';
        
        validLeaveRecords.push({
          name,
          reason: record.reason,
          imageUrl: record.image_url,
          leaveType: record.leave_type,
          startDate: record.start_date,
          endDate: record.end_date,
          weekdays: record.weekdays,
          period: periodLabel
        });
      }
    });

    // 赣青二课记录
    const ganqingRecords: Array<{ name: string }> = [];
    records?.forEach(record => {
      const name = memberMap.get(record.member_id) || '未知';
      if (record.status === '赣青二课') {
        ganqingRecords.push({ name });
      }
    });

    // 去重赣青二课
    const uniqueGanqing = Array.from(
      new Map(ganqingRecords.map(r => [r.name, r])).values()
    );

    return NextResponse.json({
      date,
      leaveRecords: validLeaveRecords,
      ganqingRecords: uniqueGanqing
    });
  } catch (error) {
    return NextResponse.json({ error: '获取导出数据失败' }, { status: 500 });
  }
}

// 获取所有请假记录（管理后台用）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { classId } = body;

    if (!classId) {
      return NextResponse.json({ error: '缺少班级ID' }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    const { data: leaveRecords, error } = await client
      .from('leave_records')
      .select('*')
      .eq('is_active', '1')
      .eq('class_id', classId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 获取成员信息
    const { data: members } = await client
      .from('class_members')
      .select('id, name')
      .eq('class_id', classId);

    const memberMap = new Map();
    members?.forEach(m => memberMap.set(m.id, m.name));

    const result = leaveRecords?.map(record => ({
      id: record.id,
      memberId: record.member_id,
      memberName: memberMap.get(record.member_id) || '未知',
      leaveType: record.leave_type,
      startDate: record.start_date,
      endDate: record.end_date,
      weekdays: record.weekdays,
      period: record.period,
      reason: record.reason,
      imageUrl: record.image_url,
      createdAt: record.created_at
    }));

    return NextResponse.json({ records: result });
  } catch (error) {
    return NextResponse.json({ error: '获取请假记录失败' }, { status: 500 });
  }
}

// 取消请假记录
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少请假记录ID' }, { status: 400 });
    }

    const client = getSupabaseClient();

    const { error } = await client
      .from('leave_records')
      .update({ is_active: '0' })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '取消请假记录失败' }, { status: 500 });
  }
}
