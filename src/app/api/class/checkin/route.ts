/**
 * ============================================================================
 * 文件: src/app/api/class/checkin/route.ts
 * 目录: 签到记录 API
 * 功能: 
 *   - GET: 获取签到记录列表（含请假状态）
 *   - POST: 提交签到（含位置验证）
 *   - DELETE: 重置签到记录
 * 依赖: Haversine公式计算GPS距离
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 使用Haversine公式计算两点距离（米）
 * 不调用第三方API，本地计算
 */
function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371000; // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * 异步日志 - 不阻塞主流程
 */
function logAsync(message: string, data?: any) {
  setTimeout(() => {
    console.log(`[CheckIn] ${new Date().toISOString()} ${message}`, data || '');
  }, 0);
}

// 获取签到记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const period = searchParams.get('period') || 'morning';
    const classId = searchParams.get('classId');

    if (!classId) {
      return NextResponse.json({ error: '缺少班级ID' }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    // 获取成员列表
    const { data: members, error: membersError } = await client
      .from('class_members')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: true });

    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }

    // 获取当日该时段的签到记录
    const { data: records, error: recordsError } = await client
      .from('check_in_records')
      .select('*')
      .eq('date', date)
      .eq('period', period)
      .eq('class_id', classId);

    if (recordsError) {
      return NextResponse.json({ error: recordsError.message }, { status: 500 });
    }

    // 获取所有有效的请假记录
    const { data: leaveRecords } = await client
      .from('leave_records')
      .select('*')
      .eq('is_active', '1')
      .eq('class_id', classId);

    // 过滤出当前日期有效的请假记录
    const currentDate = new Date(date);
    const currentWeekday = currentDate.getDay();

    const validLeaveMap = new Map<string, any>();
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

      if (isValid && (record.period === 'all' || record.period === period)) {
        if (!validLeaveMap.has(record.member_id)) {
          validLeaveMap.set(record.member_id, record);
        }
      }
    });

    // 组合数据
    const checkInMap = new Map();
    records?.forEach(record => {
      checkInMap.set(record.member_id, record);
    });

    const result = members?.map(member => {
      const hasCheckIn = checkInMap.has(member.id);
      const leaveRecord = validLeaveMap.get(member.id);
      
      return {
        id: member.id,
        name: member.name,
        checkedIn: hasCheckIn,
        record: checkInMap.get(member.id) || null,
        hasValidLeave: !!leaveRecord,
        leaveRecord: leaveRecord ? {
          id: leaveRecord.id,
          leaveType: leaveRecord.leave_type,
          startDate: leaveRecord.start_date,
          endDate: leaveRecord.end_date,
          weekdays: leaveRecord.weekdays,
          reason: leaveRecord.reason,
          imageUrl: leaveRecord.image_url
        } : null
      };
    });

    return NextResponse.json({ 
      date,
      period,
      members: result,
      total: members?.length || 0,
      checkedIn: records?.length || 0
    });
  } catch (error) {
    return NextResponse.json({ error: '获取签到记录失败' }, { status: 500 });
  }
}

// 提交签到
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { memberId, classId, period, status, note, imageUrl, latitude, longitude, userConfirmedLocation } = body;

    // 参数校验
    if (!memberId || !classId || !status) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 赣青二课必须上传图片
    if (status === '赣青二课' && !imageUrl) {
      return NextResponse.json({ error: '赣青二课必须上传活动截图' }, { status: 400 });
    }

    // 其他状态必须填写说明
    if (status === '其他' && !note) {
      return NextResponse.json({ error: '请填写说明' }, { status: 400 });
    }

    const validPeriod = period || 'morning';
    if (!['morning', 'evening', 'temp'].includes(validPeriod)) {
      return NextResponse.json({ error: '无效的签到时段' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const client = getSupabaseClient();

    // 1. 检查是否已签到（使用索引快速查询）
    const { data: existing } = await client
      .from('check_in_records')
      .select('id')
      .eq('member_id', memberId)
      .eq('date', today)
      .eq('period', validPeriod)
      .eq('class_id', classId)
      .single();

    if (existing) {
      logAsync('重复签到被拒绝', { memberId, date: today, period: validPeriod });
      return NextResponse.json({ error: '该时段已签到' }, { status: 400 });
    }

    // 2. 获取签到设置（时间限制和位置要求）
    const { data: settings } = await client
      .from('check_in_settings')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 3. 时间校验
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const limitTime = validPeriod === 'morning' 
      ? settings?.morning_limit_time 
      : settings?.evening_limit_time;

    if (limitTime && currentTime > limitTime) {
      logAsync('超时签到', { memberId, currentTime, limitTime });
    }

    // 4. 位置校验 - 仅正常出勤需要定位
    let distance: number | null = null;
    let locationValid = true;
    
    // 只有正常出勤需要位置验证
    if (status === '正常出勤' && settings?.target_latitude && settings?.target_longitude) {
      // 如果用户提供了GPS位置
      if (latitude !== undefined && longitude !== undefined) {
        distance = calculateDistance(
          latitude, 
          longitude, 
          settings.target_latitude, 
          settings.target_longitude
        );
        
        const distanceLimit = settings.distance_limit || 100;
        locationValid = distance <= distanceLimit;
        
        logAsync('位置校验', { 
          memberId, 
          distance, 
          limit: distanceLimit, 
          valid: locationValid 
        });
        
        if (!locationValid) {
          return NextResponse.json({ 
            error: `不在签到范围内（距离${distance}米，限制${distanceLimit}米）` 
          }, { status: 400 });
        }
      } 
      // 用户手动确认位置（降级方案）
      else if (userConfirmedLocation) {
        logAsync('用户确认位置', { memberId, note: '用户手动确认在现场' });
        // 允许签到，但记录距离为-1表示用户确认
        distance = -1;
      }
      // 既没有GPS位置也没有用户确认
      else if (settings.distance_limit && settings.distance_limit > 0) {
        logAsync('缺少位置信息', { memberId });
        return NextResponse.json({ 
          error: '请获取位置或确认在现场以完成签到' 
        }, { status: 400 });
      }
    }

    // 5. 创建签到记录（仅插入1条）
    const { data, error } = await client
      .from('check_in_records')
      .insert({
        member_id: memberId,
        class_id: classId,
        date: today,
        period: validPeriod,
        status,
        note: note || null,
        image_url: imageUrl || null,
        latitude: latitude || null,
        longitude: longitude || null,
        distance: distance
      })
      .select()
      .single();

    if (error) {
      logAsync('签到失败', { memberId, error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 6. 异步日志 - 不阻塞响应
    logAsync('签到成功', { 
      memberId, 
      date: today, 
      period: validPeriod, 
      status,
      distance,
      userConfirmed: userConfirmedLocation,
      duration: `${Date.now() - startTime}ms`
    });

    return NextResponse.json({ 
      success: true, 
      record: data,
      distance: distance && distance > 0 ? distance : null,
      userConfirmed: userConfirmedLocation
    });
  } catch (error) {
    logAsync('签到异常', error);
    return NextResponse.json({ error: '签到失败' }, { status: 500 });
  }
}

// 重置签到
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const period = searchParams.get('period');
    const classId = searchParams.get('classId');

    if (!classId) {
      return NextResponse.json({ error: '缺少班级ID' }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    let query = client
      .from('check_in_records')
      .delete()
      .eq('date', date)
      .eq('class_id', classId);
    
    if (period) {
      query = query.eq('period', period);
    }
    
    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logAsync('签到已重置', { date, period, classId });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '重置失败' }, { status: 500 });
  }
}
