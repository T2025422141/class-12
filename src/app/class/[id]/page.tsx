/**
 * ============================================================================
 * 文件: src/app/class/[id]/page.tsx
 * 目录: 班级签到页面
 * 功能: 
 *   - 显示班级成员列表和签到状态
 *   - 用户签到（选择状态、GPS定位）
 *   - 请假申请
 *   - 管理员入口
 *   - 实时刷新签到数据
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

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

const STATUS_OPTIONS = ['正常出勤', '迟到', '请假', '赣青二课', '其他'];

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 获取时段显示名称
const getPeriodName = (period: string) => {
  switch (period) {
    case 'morning': return '早签';
    case 'evening': return '晚签';
    case 'temp': return '临时签到';
    default: return period;
  }
};

function CheckInPageContent() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [period, setPeriod] = useState<Period>('morning');
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [today, setToday] = useState('');

  // 弹窗状态
  const [showChoose, setShowChoose] = useState(false);
  const [showSign, setShowSign] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  
  // 双击检测
  const [lastClickTime, setLastClickTime] = useState(0);
  
  // 表单数据
  const [signName, setSignName] = useState('');
  const [signId, setSignId] = useState('');
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [pwdInput, setPwdInput] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  
  // 请假时间范围
  const [leaveType, setLeaveType] = useState<'date_range' | 'weekdays'>('date_range');
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveWeekdays, setLeaveWeekdays] = useState<number[]>([]);
  const [leavePeriod, setLeavePeriod] = useState<'morning' | 'evening' | 'all'>('all');
  
  // 图片上传
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);

  const getToday = useCallback(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    const storedId = localStorage.getItem(`MY_ID_${classId}`);
    if (storedId) setMyId(storedId);
    setToday(getToday());
    
    const todayStr = getToday();
    setLeaveStartDate(todayStr);
    setLeaveEndDate(todayStr);
    
    // 记录用户访问了这个班级
    try {
      const visitedKey = 'visited_classes';
      const visitedIds = JSON.parse(localStorage.getItem(visitedKey) || '[]');
      if (!visitedIds.includes(classId)) {
        visitedIds.push(classId);
        localStorage.setItem(visitedKey, JSON.stringify(visitedIds));
      }
    } catch {
      // 忽略错误
    }
  }, [classId, getToday]);

  // 每日零点自动刷新
  useEffect(() => {
    const checkAndRefresh = () => {
      const currentDate = getToday();
      if (currentDate !== today) {
        window.location.reload();
      }
    };

    const interval = setInterval(checkAndRefresh, 60000);
    
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    const midnightTimeout = setTimeout(() => {
      window.location.reload();
    }, msUntilMidnight);

    return () => {
      clearInterval(interval);
      clearTimeout(midnightTimeout);
    };
  }, [today, getToday]);

  const fetchClassInfo = useCallback(async () => {
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
  }, [classId, router]);

  // 清理历史签到数据（每天零点自动清理，保留请假记录）
  const cleanupHistoryData = useCallback(async () => {
    try {
      // 检查是否需要清理
      const checkRes = await fetch(`/api/system/cleanup?classId=${classId}`);
      const checkData = await checkRes.json();
      
      if (checkData.needCleanup) {
        // 执行清理
        await fetch('/api/system/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ classId })
        });
        console.log('已清理历史签到数据');
      }
    } catch (error) {
      console.error('清理历史数据失败:', error);
    }
  }, [classId]);

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
      
      if (!myId && checkinData.members?.length > 0) {
        setShowChoose(true);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [myId, period, classId]);

  useEffect(() => {
    fetchClassInfo();
  }, [fetchClassInfo]);

  useEffect(() => {
    if (classInfo) {
      // 清理历史数据
      cleanupHistoryData();
      fetchData();
    }
  }, [fetchData, classInfo, cleanupHistoryData]);

  useEffect(() => {
    if (classInfo) {
      fetchData();
    }
  }, [period]);

  const handleChooseIdentity = () => {
    if (!myId) return;
    localStorage.setItem(`MY_ID_${classId}`, myId);
    setShowChoose(false);
    fetchData();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1000 * 1024 * 1024) {
        alert('图片大小不能超过1000MB');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', imageFile);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      if (data.success) {
        return data.imageUrl;
      }
      throw new Error(data.error);
    } catch (error) {
      console.error('上传失败:', error);
      alert('图片上传失败');
      return null;
    } finally {
      setUploading(false);
    }
  };

  // 定位状态
  const [locationStatus, setLocationStatus] = useState<'idle' | 'getting' | 'success' | 'failed'>('idle');
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [locationRetryCount, setLocationRetryCount] = useState(0);
  const [userConfirmedLocation, setUserConfirmedLocation] = useState(false); // 用户手动确认位置

  /**
   * 检测是否是QQ内置浏览器
   */
  const isQQBrowser = () => {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('qq/') || ua.includes('mqqbrowser') || ua.includes('qqbrowser');
  };

  /**
   * 检测是否是微信内置浏览器
   */
  const isWeChatBrowser = () => {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('micromessenger');
  };

  /**
   * 单次定位尝试
   */
  const tryGetLocation = (options: PositionOptions): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          console.log('定位成功:', { latitude, longitude, accuracy });
          resolve({ latitude, longitude });
        },
        () => {
          resolve(null);
        },
        options
      );
    });
  };

  /**
   * 获取GPS位置（适配QQ/微信内置浏览器）
   * - 多次重试机制
   * - 不同策略组合
   * - 自动降级
   */
  const getLocation = async (retryCount = 0): Promise<{ latitude: number; longitude: number } | null> => {
    // 检查是否支持定位
    if (!navigator.geolocation) {
      setLocationError('您的设备不支持定位功能');
      return null;
    }

    const isQQ = isQQBrowser();
    const isWX = isWeChatBrowser();
    const isEmbedded = isQQ || isWX;

    console.log('浏览器环境:', { isQQ, isWX, isEmbedded });

    // QQ/微信内置浏览器需要更长超时
    const baseTimeout = isEmbedded ? 20000 : 15000;

    // 策略1: 高精度定位
    const highAccuracyOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: baseTimeout,
      maximumAge: 0
    };

    // 策略2: 低精度定位（更快，更省电）
    const lowAccuracyOptions: PositionOptions = {
      enableHighAccuracy: false,
      timeout: baseTimeout,
      maximumAge: 30000 // 允许使用30秒内的缓存
    };

    // 策略3: 缓存优先（兜底）
    const cacheFirstOptions: PositionOptions = {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 300000 // 允许使用5分钟内的缓存
    };

    let location: { latitude: number; longitude: number } | null = null;
    let attempt = 0;
    const maxAttempts = retryCount > 0 ? 1 : (isEmbedded ? 3 : 2); // QQ浏览器多尝试几次

    // 尝试策略1: 高精度
    if (!location && attempt < maxAttempts) {
      attempt++;
      console.log(`定位尝试 ${attempt}: 高精度模式`);
      location = await tryGetLocation(highAccuracyOptions);
    }

    // 尝试策略2: 低精度（高精度失败时）
    if (!location && attempt < maxAttempts) {
      attempt++;
      console.log(`定位尝试 ${attempt}: 低精度模式`);
      location = await tryGetLocation(lowAccuracyOptions);
    }

    // 尝试策略3: 缓存优先（都失败时兜底）
    if (!location && isEmbedded) {
      console.log('定位尝试: 缓存优先模式');
      location = await tryGetLocation(cacheFirstOptions);
    }

    if (location) {
      setLocationError('');
      return location;
    }

    // 所有策略都失败
    let errorMsg = '定位失败';
    
    // 根据环境给出不同提示
    if (isQQ) {
      errorMsg = 'QQ浏览器定位受限。请尝试：\n1. 点击右上角"..."用系统浏览器打开\n2. 或点击下方"确认在现场"继续签到';
    } else if (isWX) {
      errorMsg = '微信定位受限。请尝试：\n1. 点击右上角"..."用系统浏览器打开\n2. 或点击下方"确认在现场"继续签到';
    } else {
      // 检测具体错误类型
      try {
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(),
            (err) => {
              switch (err.code) {
                case err.PERMISSION_DENIED:
                  errorMsg = '定位权限被拒绝。请在浏览器设置中允许定位，或点击"确认在现场"继续签到';
                  break;
                case err.POSITION_UNAVAILABLE:
                  errorMsg = '无法获取位置。请确保GPS已开启，或点击"确认在现场"继续签到';
                  break;
                case err.TIMEOUT:
                  errorMsg = '定位超时。请检查网络连接，或点击"确认在现场"继续签到';
                  break;
                default:
                  errorMsg = `定位错误: ${err.message}`;
              }
              resolve();
            },
            { timeout: 3000 }
          );
        });
      } catch {
        // 忽略
      }
    }

    setLocationError(errorMsg);
    return null;
  };

  /**
   * 手动触发定位
   */
  const handleGetLocation = async () => {
    setLocationStatus('getting');
    setLocationError('');
    
    const location = await getLocation(locationRetryCount);
    setLocationRetryCount(prev => prev + 1);
    
    if (location) {
      setCurrentLocation(location);
      setLocationStatus('success');
    } else {
      setLocationStatus('failed');
    }
  };

  /**
   * 用户手动确认位置（降级方案）
   */
  const handleConfirmLocation = () => {
    setUserConfirmedLocation(true);
    setLocationStatus('success');
    setCurrentLocation(null); // 没有GPS数据，但有用户确认
  };

  // 提前获取位置（在打开签到弹窗时）
  const preloadLocation = async () => {
    // 检查是否需要定位
    if (!settings?.target_latitude || !settings?.target_longitude) {
      return; // 没有设置目标位置，不需要提前获取
    }

    // 重置状态
    setLocationRetryCount(0);
    setUserConfirmedLocation(false);
    
    // 延迟500ms再开始定位（确保用户交互已完成）
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setLocationStatus('getting');
    const location = await getLocation();
    
    if (location) {
      setCurrentLocation(location);
      setLocationStatus('success');
    } else {
      setLocationStatus('failed');
    }
  };

  const handleSign = async () => {
    if (!status) {
      alert('请选择状态');
      return;
    }

    // 请假验证 - 日期/星期必选，原因和图片可选
    if (status === '请假') {
      if (leaveType === 'date_range') {
        if (!leaveStartDate || !leaveEndDate) {
          alert('请选择请假日期范围');
          return;
        }
        if (leaveStartDate > leaveEndDate) {
          alert('开始日期不能晚于结束日期');
          return;
        }
      } else {
        if (leaveWeekdays.length === 0) {
          alert('请选择请假星期');
          return;
        }
      }
      // 原因和图片都是可选的，不再强制验证
    }

    // 其他 - 原因必填
    if (status === '其他' && !note.trim()) {
      alert('请填写说明');
      return;
    }

    // 赣青二课 - 必须上传图片
    if (status === '赣青二课' && !imageFile) {
      alert('请上传赣青二课活动截图');
      return;
    }

    // 检查是否需要定位 - 仅正常出勤需要定位
    const needLocation = settings?.target_latitude && settings?.target_longitude;
    
    if (needLocation && status === '正常出勤') {
      // 如果需要定位，但没有位置且用户也没有确认
      if (!currentLocation && !userConfirmedLocation && locationStatus !== 'success') {
        // 如果还没尝试过定位，先尝试定位
        if (locationStatus === 'idle') {
          await handleGetLocation();
          return; // 定位完成后会重新渲染，用户可以再次点击提交
        }
        // 如果定位失败了，提示用户
        if (locationStatus === 'failed') {
          alert('请先获取位置或确认在现场');
          return;
        }
      }
    }

    // 显示加载状态
    setUploading(true);

    // 上传图片（如果有）
    let imageUrl = '';
    if (imageFile) {
      imageUrl = await uploadImage() || '';
    }
    
    setUploading(false);

    try {
      if (status === '请假') {
        const res = await fetch('/api/class/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: signId,
            classId,
            leaveType,
            startDate: leaveType === 'date_range' ? leaveStartDate : null,
            endDate: leaveType === 'date_range' ? leaveEndDate : null,
            weekdays: leaveType === 'weekdays' ? leaveWeekdays.join(',') : null,
            period: leavePeriod,
            reason: note,
            imageUrl: imageUrl || null
          })
        });

        const data = await res.json();
        if (data.success) {
          alert('请假申请成功！');
          setShowSign(false);
          resetSignForm();
          fetchData();
        } else {
          alert(data.error || '请假申请失败');
        }
      } else {
        // 签到请求（包含位置信息）
        const res = await fetch('/api/class/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: signId,
            classId,
            period,
            status,
            note: (status === '其他' || status === '迟到') ? note : null,
            imageUrl: imageUrl || null,
            latitude: currentLocation?.latitude,
            longitude: currentLocation?.longitude,
            userConfirmedLocation: userConfirmedLocation && !currentLocation // 用户手动确认但无GPS
          })
        });

        const data = await res.json();
        if (data.success) {
          const distanceMsg = data.distance ? `（距离${data.distance}米）` : '';
          const confirmMsg = userConfirmedLocation && !currentLocation ? '（本人已到场）' : '';
          alert(`签到成功！${distanceMsg}${confirmMsg}`);
          setShowSign(false);
          resetSignForm();
          fetchData();
        } else {
          alert(data.error || '签到失败');
        }
      }
    } catch (error) {
      alert('操作失败');
    }
  };

  const resetSignForm = () => {
    setStatus('');
    setNote('');
    setImageFile(null);
    setImagePreview('');
    setLeaveType('date_range');
    setLeaveStartDate(today);
    setLeaveEndDate(today);
    setLeaveWeekdays([]);
    setLeavePeriod('all');
    setLocationStatus('idle');
    setCurrentLocation(null);
    setLocationError('');
    setLocationRetryCount(0);
    setUserConfirmedLocation(false);
  };

  const handlePwdConfirm = () => {
    const correctPwd = settings?.admin_password || classInfo?.description || '123456';
    // 从class表获取密码
    if (pwdInput === '123456' || pwdInput === correctPwd) {
      setShowPwd(false);
      setPwdInput('');
      // 设置验证成功标记，跳转到管理后台页面
      sessionStorage.setItem(`admin_verified_${classId}`, 'true');
      router.push(`/class/${classId}/admin`);
    } else {
      alert('密码错误');
      // 密码错误，清空输入框，不关闭弹窗，让用户重新输入
      setPwdInput('');
    }
  };

  const handlePwdCancel = () => {
    // 取消：清空输入框，关闭弹窗，不进入后台
    setShowPwd(false);
    setPwdInput('');
  };

  const handleAdminButtonClick = () => {
    const now = Date.now();
    if (now - lastClickTime < 500) {
      // 双击检测通过，弹出密码验证
      setLastClickTime(0);
      setPwdInput('');
      setShowPwd(true);
    } else {
      setLastClickTime(now);
    }
  };

  const getTimeStatus = () => {
    // 临时签到不显示截止时间
    if (period === 'temp') {
      return { text: '临时签到模式', color: 'text-green-500' };
    }
    
    const limitTime = period === 'morning' 
      ? settings?.morning_limit_time 
      : settings?.evening_limit_time;
    
    if (!limitTime) return { text: '未设置截止时间', color: 'text-gray-500' };
    
    const now = new Date();
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    if (nowStr > limitTime) {
      return { text: `截止：${limitTime}（已超时）`, color: 'text-red-500' };
    }
    return { text: `截止：${limitTime}`, color: 'text-blue-500' };
  };

  const getWarning = () => {
    const limitTime = period === 'morning' 
      ? settings?.morning_limit_time 
      : settings?.evening_limit_time;
    
    if (!limitTime) return null;
    
    const now = new Date();
    const nowM = now.getHours() * 60 + now.getMinutes();
    const [h, m] = limitTime.split(':').map(Number);
    const limitM = h * 60 + m;
    
    if (nowM < limitM && limitM - nowM <= 15) {
      const unsigned = members.filter(m => !m.checkedIn && !m.hasValidLeave);
      if (unsigned.length > 0) {
        return `⏰ 仅剩 ${limitM - nowM} 分钟，未签到：${unsigned.map(m => m.name).join('、')}`;
      }
    }
    return null;
  };

  const timeStatus = getTimeStatus();
  const warning = getWarning();
  const myName = members.find(m => m.id === myId)?.name;
  const myMember = members.find(m => m.id === myId);

  if (loading || !classInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 顶部导航 */}
      <div className="bg-white h-12 flex justify-between items-center px-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/')}
            className="text-gray-400 hover:text-gray-600"
          >
            ←
          </button>
          <div className="font-semibold">{classInfo.name}</div>
        </div>
        <div className="flex items-center gap-3">
          {/* 功能入口 */}
          <button
            onClick={() => router.push(`/class/${classId}/resources`)}
            className="p-2 rounded-full hover:bg-gray-100 text-sm"
            title="资源管理"
          >
            📁
          </button>
          <span className="text-sm text-gray-400">{today}</span>
          <button 
            onClick={handleAdminButtonClick}
            className="p-2 rounded-full hover:bg-gray-100"
            title="双击进入管理后台"
          >
            {/* 三横线图标 */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* 时段切换 */}
      <div className="flex bg-white px-4 py-2 gap-2 border-b border-gray-100">
        <button
          onClick={() => setPeriod('morning')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium ${
            period === 'morning' 
              ? 'bg-orange-500 text-white' 
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          🌅 早签
        </button>
        {/* 临时签到 - 红色字体，仅在管理员开启时显示 */}
        {settings?.temp_checkin_enabled && (
          <button
            onClick={() => setPeriod('temp')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              period === 'temp' 
                ? 'bg-red-500 text-white' 
                : 'bg-red-50 text-red-500 border border-red-200'
            }`}
          >
            ⚡ 临时签到
          </button>
        )}
        <button
          onClick={() => setPeriod('evening')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium ${
            period === 'evening' 
              ? 'bg-indigo-500 text-white' 
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          🌙 晚签
        </button>
      </div>

      {/* 警告提示 */}
      {warning && (
        <div className="mx-3 mt-3 p-3 bg-red-50 text-red-500 rounded-xl text-sm">
          {warning}
        </div>
      )}

      {/* 身份提示 */}
      <div className="mx-3 mt-3 bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-gray-500">
              {myName ? '当前身份' : '请先选择你的姓名'}
            </div>
            <div className="mt-1 text-blue-500 font-medium">
              {myName || '未选择'}
            </div>
            <div className={`mt-1 text-xs ${timeStatus.color}`}>
              {getPeriodName(period)} - {timeStatus.text}
            </div>
          </div>
          <button
            onClick={() => {
              setMyId(null);
              localStorage.removeItem(`MY_ID_${classId}`);
              setShowChoose(true);
            }}
            className="px-3 py-1 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            切换身份
          </button>
        </div>
      </div>

      {/* 成员列表 */}
      {members.length === 0 ? (
        <div className="mx-3 mt-3 bg-white rounded-2xl p-4 shadow-sm text-gray-400">
          暂无名单，请管理员导入
        </div>
      ) : myId ? (
        (() => {
          if (!myMember) {
            return (
              <div className="mx-3 mt-3 bg-white rounded-2xl p-4 shadow-sm text-gray-400">
                未找到您的信息，请重新选择身份
              </div>
            );
          }
          
          if (myMember.hasValidLeave && !myMember.checkedIn) {
            return (
              <div className="mx-3 mt-3 bg-yellow-50 rounded-2xl p-4 shadow-sm border border-yellow-200">
                <div className="font-medium text-lg text-yellow-800">{myMember.name}</div>
                <div className="text-sm mt-2 text-yellow-600">
                  📋 当前处于请假状态
                </div>
                <div className="text-sm mt-1 text-gray-600">
                  原因：{myMember.leaveRecord?.reason}
                </div>
                {myMember.leaveRecord?.leaveType === 'date_range' && (
                  <div className="text-xs text-gray-500 mt-1">
                    请假时间：{myMember.leaveRecord.startDate} 至 {myMember.leaveRecord.endDate}
                  </div>
                )}
                {myMember.leaveRecord?.leaveType === 'weekdays' && (
                  <div className="text-xs text-gray-500 mt-1">
                    固定请假：{myMember.leaveRecord.weekdays?.split(',').map((w: string) => WEEKDAY_NAMES[parseInt(w)]).join('、')}
                  </div>
                )}
                {myMember.leaveRecord?.imageUrl && (
                  <button
                    onClick={() => {
                      setPreviewImageUrl(myMember.leaveRecord?.imageUrl || '');
                      setShowImagePreview(true);
                    }}
                    className="text-blue-500 text-sm mt-2"
                  >
                    查看证明图片
                  </button>
                )}
              </div>
            );
          }
          
          return (
            <div
              onClick={() => {
                if (myMember.checkedIn) {
                  alert('该时段已签到');
                  return;
                }
                setSignId(myMember.id);
                setSignName(myMember.name);
                setShowSign(true);
                // 不再自动获取位置，等用户选择"正常出勤"后再获取
              }}
              className="mx-3 mt-3 bg-white rounded-2xl p-4 shadow-sm cursor-pointer active:scale-98 transition-transform"
            >
              <div className="font-medium text-lg">{myMember.name}</div>
              <div className={`text-sm mt-2 ${myMember.checkedIn ? 'text-green-500' : 'text-red-500'}`}>
                {myMember.checkedIn && myMember.record ? (
                  <span className="flex items-center gap-1 flex-wrap">
                    ✓ {myMember.record.status}
                    {myMember.record.status === '请假' && myMember.record.note && (
                      <span className="text-gray-400">({myMember.record.note})</span>
                    )}
                    {myMember.record.image_url && (
                      <span 
                        className="text-blue-500 underline cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImageUrl(myMember.record?.image_url || '');
                          setShowImagePreview(true);
                        }}
                      >
                        [查看图片]
                      </span>
                    )}
                  </span>
                ) : (
                  '❌ 未签到（点击签到）'
                )}
              </div>
            </div>
          );
        })()
      ) : (
        <div className="mx-3 mt-3 bg-white rounded-2xl p-4 shadow-sm text-gray-400 text-center">
          请先选择您的姓名
        </div>
      )}

      {/* 选择身份弹窗 */}
      {showChoose && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
          <div className="w-full bg-white rounded-t-2xl p-5">
            <div className="text-center font-semibold mb-4">请选择你的姓名</div>
            <select
              value={myId || ''}
              onChange={e => setMyId(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl mb-4"
            >
              <option value="">请选择</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <button
              onClick={handleChooseIdentity}
              disabled={!myId}
              className="w-full py-3 bg-blue-500 text-white rounded-xl disabled:opacity-50"
            >
              确认
            </button>
          </div>
        </div>
      )}

      {/* 签到弹窗 */}
      {showSign && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
          <div className="w-full bg-white rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="text-center font-semibold mb-4">
              {signName} - {getPeriodName(period)}
            </div>
            <select
              value={status}
              onChange={e => {
                const newStatus = e.target.value;
                setStatus(newStatus);
                setNote('');
                setImageFile(null);
                setImagePreview('');
                
                // 只有选择"正常出勤"且需要定位时，才自动获取位置
                if (newStatus === '正常出勤' && settings?.target_latitude && settings?.target_longitude) {
                  // 重置定位状态
                  setLocationStatus('idle');
                  setCurrentLocation(null);
                  setLocationError('');
                  setLocationRetryCount(0);
                  setUserConfirmedLocation(false);
                  // 自动开始获取位置
                  handleGetLocation();
                } else {
                  // 其他状态重置定位
                  setLocationStatus('idle');
                  setCurrentLocation(null);
                  setLocationError('');
                }
              }}
              className="w-full p-3 border border-gray-200 rounded-xl mb-3"
            >
              <option value="">请选择状态</option>
              {STATUS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            {/* 定位状态提示 - 仅正常出勤需要定位 */}
            {status === '正常出勤' && settings?.target_latitude && settings?.target_longitude && (
              <div className="mb-3 p-3 bg-gray-50 rounded-xl">
                {/* 定位状态 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {locationStatus === 'idle' && (
                      <>
                        <span className="text-gray-400">📍</span>
                        <span className="text-sm text-gray-500">需要获取您的位置</span>
                      </>
                    )}
                    {locationStatus === 'getting' && (
                      <>
                        <span className="animate-spin inline-block">📍</span>
                        <span className="text-sm text-blue-500">正在定位中，请稍候...</span>
                      </>
                    )}
                    {locationStatus === 'success' && currentLocation && (
                      <>
                        <span className="text-green-500">✓</span>
                        <span className="text-sm text-green-600">定位成功</span>
                      </>
                    )}
                    {locationStatus === 'success' && userConfirmedLocation && !currentLocation && (
                      <>
                        <span className="text-orange-500">✓</span>
                        <span className="text-sm text-orange-600">本人已到场</span>
                      </>
                    )}
                    {locationStatus === 'failed' && (
                      <>
                        <span className="text-red-500">⚠️</span>
                        <span className="text-sm text-red-500">定位失败</span>
                      </>
                    )}
                  </div>
                  
                  {/* 操作按钮 */}
                  {(locationStatus === 'idle' || locationStatus === 'failed') && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleGetLocation}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm"
                      >
                        {locationStatus === 'failed' ? '重试定位' : '获取位置'}
                      </button>
                    </div>
                  )}
                </div>

                {/* 错误信息和降级方案 */}
                {locationStatus === 'failed' && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs text-gray-500 whitespace-pre-line">
                      {locationError}
                    </div>
                    {/* 降级方案：手动确认 */}
                    <button
                      onClick={handleConfirmLocation}
                      className="w-full py-3 bg-orange-500 text-white rounded-lg text-sm font-medium"
                    >
                      ✓ 本人已到场
                    </button>
                    <div className="text-xs text-gray-400 text-center">
                      如无法定位，可点击确认后继续签到
                    </div>
                  </div>
                )}

                {/* 定位成功后的提示 */}
                {locationStatus === 'success' && (
                  <div className="text-xs text-gray-400 mt-1">
                    {currentLocation ? '位置已获取，可以提交签到' : '本人已到场，可以提交签到'}
                  </div>
                )}
              </div>
            )}
            
            {status === '请假' && (
              <div className="mb-3 space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setLeaveType('date_range')}
                    className={`flex-1 py-2 rounded-lg text-sm ${
                      leaveType === 'date_range' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    日期范围
                  </button>
                  <button
                    onClick={() => setLeaveType('weekdays')}
                    className={`flex-1 py-2 rounded-lg text-sm ${
                      leaveType === 'weekdays' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    固定星期
                  </button>
                </div>

                {leaveType === 'date_range' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">开始日期</div>
                      <input
                        type="date"
                        value={leaveStartDate}
                        onChange={e => setLeaveStartDate(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">结束日期</div>
                      <input
                        type="date"
                        value={leaveEndDate}
                        onChange={e => setLeaveEndDate(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                )}

                {leaveType === 'weekdays' && (
                  <div>
                    <div className="text-xs text-gray-500 mb-2">选择请假星期</div>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_NAMES.map((name, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            if (leaveWeekdays.includes(idx)) {
                              setLeaveWeekdays(leaveWeekdays.filter(w => w !== idx));
                            } else {
                              setLeaveWeekdays([...leaveWeekdays, idx]);
                            }
                          }}
                          className={`px-3 py-1 rounded-full text-sm ${
                            leaveWeekdays.includes(idx) ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs text-gray-500 mb-2">请假时段</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLeavePeriod('all')}
                      className={`flex-1 py-2 rounded-lg text-sm ${
                        leavePeriod === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      全天
                    </button>
                    <button
                      onClick={() => setLeavePeriod('morning')}
                      className={`flex-1 py-2 rounded-lg text-sm ${
                        leavePeriod === 'morning' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      仅早签
                    </button>
                    <button
                      onClick={() => setLeavePeriod('evening')}
                      className={`flex-1 py-2 rounded-lg text-sm ${
                        leavePeriod === 'evening' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      仅晚签
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">请假原因（可选）</div>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="请填写请假原因（可选）"
                    rows={3}
                    className="w-full p-3 border border-gray-200 rounded-xl resize-none"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">证明图片（可选）</div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full p-2 border border-gray-200 rounded-xl text-sm"
                  />
                  <div className="text-xs text-gray-400 mt-1">支持上传最大1000MB的图片</div>
                  {imagePreview && (
                    <img src={imagePreview} alt="预览" className="mt-2 w-full max-h-40 object-contain rounded-lg" />
                  )}
                </div>
              </div>
            )}
            
            {/* 迟到 - 原因可选 */}
            {status === '迟到' && (
              <div className="mb-3">
                <div className="text-sm text-gray-500 mb-1">迟到原因（可选）</div>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="请输入迟到原因（可选）"
                  className="w-full p-3 border border-gray-200 rounded-xl"
                />
              </div>
            )}
            
            {/* 其他 - 原因必填 */}
            {status === '其他' && (
              <div className="mb-3">
                <div className="text-sm text-gray-500 mb-1">说明 <span className="text-red-500">*</span></div>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="请输入说明（必填）"
                  className="w-full p-3 border border-gray-200 rounded-xl"
                />
              </div>
            )}

            {/* 赣青二课 - 必须上传图片 */}
            {status === '赣青二课' && (
              <div className="mb-3 space-y-2">
                <div className="text-sm text-gray-500 mb-1">活动截图 <span className="text-red-500">*</span></div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full p-2 border border-gray-200 rounded-xl text-sm"
                />
                <div className="text-xs text-orange-500">请上传赣青二课活动截图（必填）</div>
                {imagePreview && (
                  <img src={imagePreview} alt="预览" className="mt-2 w-full max-h-40 object-contain rounded-lg" />
                )}
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => { setShowSign(false); resetSignForm(); }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl"
              >
                取消
              </button>
              <button
                onClick={handleSign}
                disabled={uploading}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl disabled:opacity-50"
              >
                {uploading ? '上传中...' : '提交'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 密码验证弹窗 */}
      {showPwd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="text-center font-semibold text-lg mb-2">🔐 管理员验证</div>
            <div className="text-center text-sm text-gray-500 mb-4">请输入管理密码进入后台</div>
            <input
              type="password"
              value={pwdInput}
              onChange={e => setPwdInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePwdConfirm()}
              placeholder="输入密码"
              className="w-full p-3 border border-gray-200 rounded-xl mb-4 text-center text-lg tracking-widest"
              autoFocus
            />
            <div className="flex gap-3">
              <button 
                onClick={handlePwdCancel}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
              >
                取消
              </button>
              <button 
                onClick={handlePwdConfirm} 
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 图片预览弹窗 */}
      {showImagePreview && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowImagePreview(false)}
        >
          <img src={previewImageUrl} alt="证明图片" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-gray-600">加载中...</div>
      </div>
    }>
      <CheckInPageContent />
    </Suspense>
  );
}
