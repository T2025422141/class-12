/**
 * ============================================================================
 * 文件: src/app/class/[id]/admin/page.tsx
 * 目录: 班级管理后台
 * 功能: 
 *   - 签到统计（可点击查看详情）
 *   - 签到配置（时间、位置）
 *   - 成员管理（导入）
 *   - 请假记录管理
 *   - 数据导出
 *   - 签到提醒
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Member {
  id: string;
  name: string;
  checkedIn: boolean;
  record: {
    id: number;
    status: string;
    note: string | null;
    image_url: string | null;
    check_in_time: string;
  } | null;
  hasValidLeave: boolean;
  leaveRecord: {
    id: number;
    leaveType: string;
    startDate: string | null;
    endDate: string | null;
    weekdays: string | null;
    reason: string;
    imageUrl: string | null;
  } | null;
}

interface ClassInfo {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
}

interface Settings {
  date: string;
  morning_limit_time: string | null;
  evening_limit_time: string | null;
  admin_password: string;
  target_latitude: number | null;
  target_longitude: number | null;
  distance_limit: number | null;
  temp_checkin_enabled: boolean;
}

interface LeaveRecord {
  id: number;
  memberId: string;
  memberName: string;
  leaveType: string;
  startDate: string | null;
  endDate: string | null;
  weekdays: string | null;
  period: string;
  reason: string;
  imageUrl: string | null;
}

type Period = 'morning' | 'evening' | 'temp';

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const getPeriodName = (period: string) => {
  switch (period) {
    case 'morning': return '早签';
    case 'evening': return '晚签';
    case 'temp': return '临时签到';
    default: return period;
  }
};

export default function AdminPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [period, setPeriod] = useState<Period>('morning');
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState('');

  // 弹窗状态
  const [showImport, setShowImport] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showLeaveList, setShowLeaveList] = useState(false);
  const [showDeleteClass, setShowDeleteClass] = useState(false);
  
  // 签到详情弹窗
  const [showCheckinDetail, setShowCheckinDetail] = useState(false);
  const [detailType, setDetailType] = useState<'checked' | 'unchecked'>('checked');
  
  // 表单数据
  const [importText, setImportText] = useState('');
  const [morningLimitTime, setMorningLimitTime] = useState('');
  const [eveningLimitTime, setEveningLimitTime] = useState('');
  const [targetLatitude, setTargetLatitude] = useState('');
  const [targetLongitude, setTargetLongitude] = useState('');
  const [distanceLimit, setDistanceLimit] = useState('100');
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  
  // 获取位置状态
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  const getToday = useCallback(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    // 检查是否已验证密码（超级管理员自动通过）
    const superAdmin = sessionStorage.getItem('super_admin_verified');
    const classAdmin = sessionStorage.getItem(`admin_verified_${classId}`);
    
    if (superAdmin !== 'true' && classAdmin !== 'true') {
      router.push(`/class/${classId}`);
      return;
    }

    setToday(getToday());
    fetchClassInfo();
  }, [classId, router, getToday]);

  const fetchClassInfo = async () => {
    try {
      const res = await fetch(`/api/class?id=${classId}`);
      const data = await res.json();
      if (data.class) {
        setClassInfo(data.class);
      } else {
        alert('班级不存在');
        router.push('/');
      }
    } catch (error) {
      console.error('获取班级信息失败:', error);
      router.push('/');
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [checkinRes, settingsRes] = await Promise.all([
        fetch(`/api/class/checkin?period=${period}&classId=${classId}`),
        fetch(`/api/class/settings?classId=${classId}`)
      ]);
      
      const checkinData = await checkinRes.json();
      const settingsData = await settingsRes.json();
      
      setMembers(checkinData.members || []);
      setSettings(settingsData.settings);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [period, classId]);

  useEffect(() => {
    if (classInfo) {
      fetchData();
    }
  }, [fetchData, classInfo]);

  useEffect(() => {
    if (classInfo) {
      fetchData();
    }
  }, [period]);

  const fetchLeaveRecords = async () => {
    try {
      const res = await fetch(`/api/export?classId=${classId}`, { method: 'POST' });
      const data = await res.json();
      setLeaveRecords(data.records || []);
    } catch (error) {
      console.error('获取请假记录失败:', error);
    }
  };

  const handleImport = async () => {
    const names = importText.split('\n').map(n => n.trim()).filter(n => n);
    if (names.length === 0) {
      alert('请输入名单');
      return;
    }

    try {
      const res = await fetch('/api/class/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names, classId })
      });

      const data = await res.json();
      if (data.success) {
        alert(`导入成功 ${data.count} 人`);
        setShowImport(false);
        setImportText('');
        fetchData();
      } else {
        alert(data.error || '导入失败');
      }
    } catch (error) {
      alert('导入失败');
    }
  };

  // 获取当前位置
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('您的浏览器不支持定位功能');
      return;
    }

    setGettingLocation(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setTargetLatitude(position.coords.latitude.toFixed(6));
        setTargetLongitude(position.coords.longitude.toFixed(6));
        setGettingLocation(false);
      },
      (error) => {
        setGettingLocation(false);
        let errorMsg = '获取位置失败';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = '您拒绝了位置请求，请在浏览器设置中允许定位权限';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = '无法获取位置信息，请检查设备定位是否开启';
            break;
          case error.TIMEOUT:
            errorMsg = '获取位置超时，请重试';
            break;
        }
        setLocationError(errorMsg);
        alert(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  const handleSaveTime = async () => {
    try {
      const res = await fetch('/api/class/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          morningLimitTime, 
          eveningLimitTime, 
          classId,
          targetLatitude: targetLatitude ? parseFloat(targetLatitude) : null,
          targetLongitude: targetLongitude ? parseFloat(targetLongitude) : null,
          distanceLimit: distanceLimit ? parseInt(distanceLimit) : null
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('保存成功');
        setShowTime(false);
        fetchData();
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      alert('保存失败');
    }
  };

  const handleReset = async () => {
    if (!confirm(`确定清空今日${getPeriodName(period)}所有记录？`)) return;
    
    try {
      const res = await fetch(`/api/class/checkin?period=${period}&classId=${classId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('已重置签到');
        fetchData();
      } else {
        alert(data.error || '重置失败');
      }
    } catch (error) {
      alert('重置失败');
    }
  };

  const handleDeleteLeave = async (id: number) => {
    if (!confirm('确定取消该请假记录？')) return;
    
    try {
      const res = await fetch(`/api/export?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('已取消请假');
        fetchLeaveRecords();
        fetchData();
      } else {
        alert(data.error || '取消失败');
      }
    } catch (error) {
      alert('取消失败');
    }
  };

  const handleExit = () => {
    sessionStorage.removeItem(`admin_verified_${classId}`);
    router.push(`/class/${classId}`);
  };

  // 计算统计数据
  const checkedMembers = members.filter(m => m.checkedIn);
  const uncheckedMembers = members.filter(m => !m.checkedIn && !m.hasValidLeave);
  const leaveMembers = members.filter(m => m.hasValidLeave);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white h-14 flex items-center justify-between px-4 border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExit}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            ←
          </button>
          <div className="font-semibold">{classInfo?.name} - 管理后台</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{today}</span>
          <button 
            onClick={handleExit}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm"
          >
            退出
          </button>
        </div>
      </div>

      {/* 主内容 */}
      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* 今日签到概况 - 可点击查看详情 */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl p-4 text-white">
          <div className="text-sm opacity-80 mb-2">{today} · {getPeriodName(period)}</div>
          <div className="flex justify-around text-center">
            <div 
              onClick={() => {
                setDetailType('checked');
                setShowCheckinDetail(true);
              }}
              className="cursor-pointer hover:scale-110 transition-transform"
            >
              <div className="text-2xl font-bold">{members.length}</div>
              <div className="text-xs opacity-80">总人数</div>
            </div>
            <div 
              onClick={() => {
                setDetailType('checked');
                setShowCheckinDetail(true);
              }}
              className="cursor-pointer hover:scale-110 transition-transform"
            >
              <div className="text-2xl font-bold text-green-300">{checkedMembers.length}</div>
              <div className="text-xs opacity-80">已签到</div>
            </div>
            <div 
              onClick={() => {
                setDetailType('unchecked');
                setShowCheckinDetail(true);
              }}
              className="cursor-pointer hover:scale-110 transition-transform"
            >
              <div className="text-2xl font-bold text-red-300">{uncheckedMembers.length}</div>
              <div className="text-xs opacity-80">未签到</div>
            </div>
          </div>
        </div>

        {/* 核心操作 */}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => fetchData()} className="py-2.5 bg-green-500 text-white rounded-xl text-sm">🔄 刷新</button>
          <button onClick={() => router.push(`/class/${classId}/remind?period=${period}`)} className="py-2.5 bg-orange-500 text-white rounded-xl text-sm">🔔 提醒</button>
          <button onClick={() => window.open(`/export?classId=${classId}&date=${today}`, '_blank')} className="py-2.5 bg-purple-500 text-white rounded-xl text-sm">📊 导出</button>
        </div>

        {/* 签到配置 */}
        <div className="bg-gray-100 rounded-xl p-3">
          <div className="text-sm text-gray-500 mb-2">签到配置</div>
          <div className="grid grid-cols-4 gap-2">
            <button onClick={() => setPeriod('morning')} className={`py-2 rounded-lg text-sm ${period === 'morning' ? 'bg-orange-500 text-white' : 'bg-white border'}`}>早签</button>
            <button onClick={() => setPeriod('evening')} className={`py-2 rounded-lg text-sm ${period === 'evening' ? 'bg-indigo-500 text-white' : 'bg-white border'}`}>晚签</button>
            <button onClick={async () => {
              const newValue = !settings?.temp_checkin_enabled;
              const res = await fetch('/api/class/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId, tempCheckinEnabled: newValue })
              });
              if ((await res.json()).success) {
                alert(newValue ? '已开启临时签到' : '已关闭临时签到');
                fetchData();
              }
            }} className={`py-2 rounded-lg text-sm ${settings?.temp_checkin_enabled ? 'bg-red-500 text-white' : 'bg-white border text-red-500'}`}>
              {settings?.temp_checkin_enabled ? '关闭临时' : '开启临时'}
            </button>
            <button onClick={() => {
              setMorningLimitTime(settings?.morning_limit_time || '09:00');
              setEveningLimitTime(settings?.evening_limit_time || '18:00');
              setTargetLatitude(settings?.target_latitude?.toString() || '');
              setTargetLongitude(settings?.target_longitude?.toString() || '');
              setDistanceLimit(settings?.distance_limit?.toString() || '100');
              setShowTime(true);
            }} className="py-2 rounded-lg text-sm bg-white border">设置</button>
          </div>
        </div>

        {/* 批量操作 */}
        <div>
          <div className="text-sm text-gray-500 mb-2">批量操作</div>
          <div className="space-y-2">
            <button onClick={async () => {
              if (uncheckedMembers.length === 0) { alert('没有未签到的成员'); return; }
              if (!confirm(`确定将 ${uncheckedMembers.length} 名未签到成员标记为缺勤？`)) return;
              let count = 0;
              for (const m of uncheckedMembers) {
                try {
                  await fetch('/api/class/checkin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memberId: m.id, classId, period, status: '缺勤' })
                  });
                  count++;
                } catch {}
              }
              alert(`已标记 ${count} 人缺勤`);
              fetchData();
            }} className="w-full py-2.5 bg-red-500 text-white rounded-xl text-sm">
              ❌ 一键标记缺勤（{uncheckedMembers.length}人）
            </button>
            <button onClick={handleReset} className="w-full py-2.5 bg-gray-500 text-white rounded-xl text-sm">
              🗑️ 重置今日签到
            </button>
          </div>
        </div>

        {/* 名单管理 */}
        <div>
          <div className="text-sm text-gray-500 mb-2">名单管理</div>
          <button onClick={() => setShowImport(true)} className="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm">📝 导入名单</button>
        </div>

        {/* 其他功能 */}
        <div>
          <div className="text-sm text-gray-500 mb-2">其他功能</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setShowLeaveList(true); fetchLeaveRecords(); }} className="py-2.5 bg-yellow-500 text-white rounded-xl text-sm">请假记录</button>
            <button onClick={() => setShowShare(true)} className="py-2.5 bg-cyan-500 text-white rounded-xl text-sm">分享链接</button>
            <button onClick={() => setShowDeleteClass(true)} className="py-2.5 bg-red-600 text-white rounded-xl text-sm col-span-2">🗑️ 删除班级</button>
          </div>
        </div>
      </div>

      {/* 签到详情弹窗 */}
      {showCheckinDetail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
              <div className="font-semibold">
                {detailType === 'checked' ? '✅ 已签到/请假' : '❌ 未签到'}列表
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setDetailType('checked')}
                  className={`px-2 py-1 rounded text-xs ${detailType === 'checked' ? 'bg-white text-blue-500' : 'bg-white/20'}`}
                >
                  已签到
                </button>
                <button 
                  onClick={() => setDetailType('unchecked')}
                  className={`px-2 py-1 rounded text-xs ${detailType === 'unchecked' ? 'bg-white text-blue-500' : 'bg-white/20'}`}
                >
                  未签到
                </button>
                <button onClick={() => setShowCheckinDetail(false)} className="p-1 hover:bg-white/20 rounded-full">
                  ✕
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {detailType === 'checked' ? (
                <>
                  {checkedMembers.length === 0 && leaveMembers.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">暂无已签到成员</div>
                  ) : (
                    <div className="space-y-1">
                      {checkedMembers.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-green-500">✓</span>
                            <span className="font-medium">{member.name}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {member.record?.status} · {member.record?.check_in_time?.slice(11, 16)}
                          </div>
                        </div>
                      ))}
                      {leaveMembers.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-500">📅</span>
                            <span className="font-medium">{member.name}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            请假
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {uncheckedMembers.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">暂无未签到成员</div>
                  ) : (
                    <div className="space-y-1">
                      {uncheckedMembers.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-red-500">✗</span>
                            <span className="font-medium">{member.name}</span>
                          </div>
                          <button 
                            onClick={async () => {
                              if (!confirm(`标记 ${member.name} 为缺勤？`)) return;
                              await fetch('/api/class/checkin', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ memberId: member.id, classId, period, status: '缺勤' })
                              });
                              fetchData();
                              setShowCheckinDetail(false);
                            }}
                            className="text-xs px-2 py-1 bg-red-500 text-white rounded"
                          >
                            标记缺勤
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="p-3 border-t bg-gray-50">
              <div className="text-xs text-gray-500 text-center">
                {detailType === 'checked' 
                  ? `已签到 ${checkedMembers.length} 人，请假 ${leaveMembers.length} 人`
                  : `未签到 ${uncheckedMembers.length} 人`
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 导入名单弹窗 */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="text-center font-semibold text-lg mb-4">📝 导入名单</div>
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder="每行一个姓名"
              rows={8}
              className="w-full p-3 border border-gray-200 rounded-xl resize-none text-sm"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowImport(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium">取消</button>
              <button onClick={handleImport} className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium">导入</button>
            </div>
          </div>
        </div>
      )}

      {/* 时间设置弹窗 */}
      {showTime && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="text-center font-semibold text-lg mb-4">⚙️ 签到设置</div>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500 mb-1">早签截止时间</div>
                <input type="time" value={morningLimitTime} onChange={e => setMorningLimitTime(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl" />
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">晚签截止时间</div>
                <input type="time" value={eveningLimitTime} onChange={e => setEveningLimitTime(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl" />
              </div>
              <div className="border-t pt-3 mt-3">
                <div className="text-sm text-gray-500 mb-2">📍 签到位置设置（可选）</div>
                <button
                  onClick={handleGetCurrentLocation}
                  disabled={gettingLocation}
                  className="w-full mb-2 py-2 bg-green-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {gettingLocation ? (
                    <>
                      <span className="animate-spin">📍</span>
                      正在获取位置...
                    </>
                  ) : (
                    <>
                      <span>📍</span>
                      自动获取当前位置
                    </>
                  )}
                </button>
                {locationError && (
                  <div className="text-xs text-red-500 mb-2">{locationError}</div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">纬度</div>
                    <input type="number" step="0.000001" value={targetLatitude} onChange={e => setTargetLatitude(e.target.value)} placeholder="如：39.9042" className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">经度</div>
                    <input type="number" step="0.000001" value={targetLongitude} onChange={e => setTargetLongitude(e.target.value)} placeholder="如：116.4074" className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xs text-gray-400 mb-1">允许距离（米）</div>
                  <input type="number" value={distanceLimit} onChange={e => setDistanceLimit(e.target.value)} placeholder="默认100米" className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  设置位置后，"正常出勤"签到时需在指定范围内
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowTime(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium">取消</button>
              <button onClick={handleSaveTime} className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 分享弹窗 */}
      {showShare && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="text-center font-semibold text-lg mb-4">分享链接</div>
            <div className="text-sm text-gray-500 mb-2">复制下方链接发送给他人：</div>
            <input
              type="text"
              readOnly
              value={typeof window !== 'undefined' ? `${window.location.origin}/class/${classId}` : ''}
              className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl mb-4 text-sm"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/class/${classId}`);
                alert('链接已复制！');
              }}
              className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium"
            >
              复制链接
            </button>
            <button onClick={() => setShowShare(false)} className="w-full py-3 mt-2 bg-gray-100 text-gray-700 rounded-xl font-medium">关闭</button>
          </div>
        </div>
      )}

      {/* 请假记录弹窗 */}
      {showLeaveList && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <div className="font-semibold">📅 请假记录</div>
              <button onClick={() => setShowLeaveList(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {leaveRecords.length === 0 ? (
                <div className="text-center text-gray-400 py-8">暂无请假记录</div>
              ) : (
                <div className="space-y-2">
                  {leaveRecords.map(record => (
                    <div key={record.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{record.memberName}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {record.leaveType === 'date_range' 
                              ? `${record.startDate} 至 ${record.endDate}`
                              : `每${record.weekdays?.split(',').map((d: string) => WEEKDAY_NAMES[parseInt(d)]).join('、')}`
                            }
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{record.reason}</div>
                        </div>
                        <button 
                          onClick={() => handleDeleteLeave(record.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 删除班级弹窗 */}
      {showDeleteClass && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="text-center font-semibold text-lg mb-4 text-red-500">⚠️ 删除班级</div>
            <div className="text-center text-gray-600 mb-4">
              确定删除班级"{classInfo?.name}"？<br/>
              <span className="text-red-500 text-sm">此操作不可恢复，所有数据将被删除！</span>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteClass(false)} 
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
              >
                取消
              </button>
              <button 
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/class?id=${classId}`, { method: 'DELETE' });
                    const data = await res.json();
                    if (data.success) {
                      alert('班级已删除');
                      router.push('/');
                    } else {
                      alert(data.error || '删除失败');
                    }
                  } catch (error) {
                    alert('删除失败');
                  }
                }}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
