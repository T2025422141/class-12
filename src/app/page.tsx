/**
 * ============================================================================
 * 文件: src/app/page.tsx
 * 目录: 首页
 * 功能: 
 *   - 显示用户访问过的班级列表
 *   - 创建新班级
 *   - 通过链接/ID加入班级
 *   - 超级管理员入口（双击标题"系统"）
 *   - 源码下载入口（双击标题"签到"）
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';

interface ClassInfo {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
}

// 存储用户访问过的班级ID
const VISITED_CLASSES_KEY = 'visited_classes';
// 超级管理员密码（可修改）
const SUPER_ADMIN_PASSWORD = 'admin888';

export default function HomePage() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createPwd, setCreatePwd] = useState('123456');
  const [creating, setCreating] = useState(false);
  const [showJoinByLink, setShowJoinByLink] = useState(false);
  const [joinClassId, setJoinClassId] = useState('');
  const [joinError, setJoinError] = useState('');
  
  // 代码下载弹窗
  const [showCodeDownload, setShowCodeDownload] = useState(false);
  const [downloading, setDownloading] = useState(false);
  
  // 超级管理员密码弹窗
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [superAdminPwd, setSuperAdminPwd] = useState('');
  const [superAdminError, setSuperAdminError] = useState('');

  useEffect(() => {
    fetchVisitedClasses();
  }, []);

  // 只获取用户访问过的班级
  const fetchVisitedClasses = async () => {
    setLoading(true);
    try {
      const visitedIds = JSON.parse(localStorage.getItem(VISITED_CLASSES_KEY) || '[]');
      
      if (visitedIds.length === 0) {
        setClasses([]);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/class');
      const data = await res.json();
      const allClasses = data.classes || [];
      
      const visitedClasses = allClasses.filter((cls: ClassInfo) => 
        visitedIds.includes(cls.id)
      );
      
      setClasses(visitedClasses);
    } catch (error) {
      console.error('获取班级列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      alert('请输入班级名称');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName,
          description: createDesc,
          adminPassword: createPwd
        })
      });

      const data = await res.json();
      if (data.success) {
        saveVisitedClass(data.class.id);
        alert('创建成功！');
        setShowCreate(false);
        setCreateName('');
        setCreateDesc('');
        setCreatePwd('123456');
        window.location.href = `/class/${data.class.id}`;
      } else {
        alert(data.error || '创建失败');
      }
    } catch (error) {
      alert('创建失败');
    } finally {
      setCreating(false);
    }
  };

  const saveVisitedClass = (classId: string) => {
    const visitedIds = JSON.parse(localStorage.getItem(VISITED_CLASSES_KEY) || '[]');
    if (!visitedIds.includes(classId)) {
      visitedIds.push(classId);
      localStorage.setItem(VISITED_CLASSES_KEY, JSON.stringify(visitedIds));
    }
  };

  // 点击班级卡片 - 进入班级
  const handleClassClick = (classId: string) => {
    saveVisitedClass(classId);
    window.location.href = `/class/${classId}`;
  };

  // 通过链接/ID加入班级
  const handleJoinByLink = async () => {
    if (!joinClassId.trim()) {
      setJoinError('请输入班级链接或ID');
      return;
    }

    let classId = joinClassId.trim();
    if (classId.includes('/class/')) {
      const match = classId.match(/\/class\/([^/]+)/);
      if (match) {
        classId = match[1];
      }
    }

    try {
      const res = await fetch(`/api/class?id=${classId}`);
      const data = await res.json();
      
      if (data.class) {
        saveVisitedClass(classId);
        window.location.href = `/class/${classId}`;
      } else {
        setJoinError('班级不存在，请检查链接或ID是否正确');
      }
    } catch (error) {
      setJoinError('验证失败，请重试');
    }
  };

  // 超级管理员登录
  const handleSuperAdminLogin = () => {
    if (superAdminPwd === SUPER_ADMIN_PASSWORD) {
      sessionStorage.setItem('super_admin_verified', 'true');
      window.location.href = '/admin';
    } else {
      setSuperAdminError('密码错误');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 顶部导航 */}
      <div className="bg-white h-14 flex justify-between items-center px-4 border-b border-gray-200 shadow-sm">
        <div className="font-bold text-xl text-gray-800">
          班级
          <span 
            onDoubleClick={() => setShowCodeDownload(true)}
            className="cursor-default select-none hover:text-blue-600 transition-colors"
            title="双击下载源码"
          >
            签到
          </span>
          <span 
            onDoubleClick={() => setShowSuperAdmin(true)}
            className="cursor-default select-none hover:text-purple-600 transition-colors"
            title="双击进入超级管理员"
          >
            系统
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowJoinByLink(true)}
            className="px-3 py-2 text-gray-600 rounded-lg text-sm hover:bg-gray-100 flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            加入班级
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            创建班级
          </button>
        </div>
      </div>

      {/* 主内容 */}
      <div className="max-w-4xl mx-auto p-4">
        {classes.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏫</div>
            <div className="text-gray-600 mb-2 font-medium">欢迎使用班级签到系统</div>
            <div className="text-gray-400 text-sm mb-6">
              创建班级开始使用，或通过链接加入已有班级
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowCreate(true)}
                className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600"
              >
                创建班级
              </button>
              <button
                onClick={() => setShowJoinByLink(true)}
                className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
              >
                加入班级
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-sm text-gray-500 mb-3 mt-4">我的班级</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => handleClassClick(cls.id)}
                  className="bg-white rounded-2xl p-5 shadow-sm cursor-pointer hover:shadow-md transition-all hover:-translate-y-1 active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-lg text-gray-800">{cls.name}</div>
                      {cls.description && (
                        <div className="text-sm text-gray-500 mt-1 line-clamp-2">{cls.description}</div>
                      )}
                    </div>
                    <div className="text-3xl">📚</div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    <div className="text-xs text-gray-400">
                      {cls.memberCount} 名成员
                    </div>
                    <div className="text-blue-500 text-sm font-medium">
                      进入 →
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 创建班级弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="text-center font-semibold text-lg mb-6">创建新班级</div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">班级名称 *</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="如：高三一班"
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-1 block">班级描述</label>
                <textarea
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="可选，如：2024届高三一班"
                  rows={2}
                  className="w-full p-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-1 block">管理员密码</label>
                <input
                  type="password"
                  value={createPwd}
                  onChange={(e) => setCreatePwd(e.target.value)}
                  placeholder="管理后台登录密码"
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="text-xs text-gray-400 mt-1">用于进入管理后台，默认123456</div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {creating ? '创建中...' : '创建班级'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 通过链接加入班级弹窗 */}
      {showJoinByLink && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="text-center font-semibold text-lg mb-4">🔗 加入班级</div>
            <div className="text-sm text-gray-500 text-center mb-4">
              输入班级链接或班级ID
            </div>
            
            <input
              type="text"
              value={joinClassId}
              onChange={(e) => {
                setJoinClassId(e.target.value);
                setJoinError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinByLink()}
              placeholder="如：/class/abc123 或 abc123"
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            
            {joinError && (
              <div className="text-red-500 text-sm text-center mt-2">{joinError}</div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowJoinByLink(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
              >
                取消
              </button>
              <button
                onClick={handleJoinByLink}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium"
              >
                加入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 超级管理员登录弹窗 */}
      {showSuperAdmin && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="text-center font-semibold text-lg mb-4">🔐 超级管理员</div>
            
            <input
              type="password"
              value={superAdminPwd}
              onChange={(e) => {
                setSuperAdminPwd(e.target.value);
                setSuperAdminError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSuperAdminLogin()}
              placeholder="请输入超级管理员密码"
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
            
            {superAdminError && (
              <div className="text-red-500 text-sm text-center mt-2">{superAdminError}</div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowSuperAdmin(false);
                  setSuperAdminPwd('');
                  setSuperAdminError('');
                }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
              >
                取消
              </button>
              <button
                onClick={handleSuperAdminLogin}
                className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-medium"
              >
                登录
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 代码下载弹窗 */}
      {showCodeDownload && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
              <div className="font-semibold text-lg">📥 项目源码下载</div>
              <button 
                onClick={() => setShowCodeDownload(false)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="text-gray-600 mb-4">
                这是一个基于 <span className="font-medium text-blue-600">Next.js 16 + React 19 + TypeScript</span> 的全栈班级签到系统。
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">项目特性：</div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✅ 多班级独立管理，支持多租户架构</li>
                  <li>✅ GPS定位签到，支持距离校验</li>
                  <li>✅ 请假管理，支持日期范围和固定星期</li>
                  <li>✅ 管理后台，密码验证保护</li>
                  <li>✅ 数据导出，支持Excel格式</li>
                  <li>✅ Supabase云端存储，多用户共享</li>
                </ul>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">技术栈：</div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-black text-white rounded text-xs">Next.js 16</span>
                  <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs">React 19</span>
                  <span className="px-2 py-1 bg-blue-600 text-white rounded text-xs">TypeScript</span>
                  <span className="px-2 py-1 bg-green-500 text-white rounded text-xs">Tailwind CSS</span>
                  <span className="px-2 py-1 bg-emerald-500 text-white rounded text-xs">Supabase</span>
                  <span className="px-2 py-1 bg-orange-500 text-white rounded text-xs">S3存储</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => setShowCodeDownload(false)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
              >
                关闭
              </button>
              <button
                onClick={async () => {
                  setDownloading(true);
                  try {
                    window.open('/api/download-source', '_blank');
                  } finally {
                    setDownloading(false);
                  }
                }}
                disabled={downloading}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {downloading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    准备下载...
                  </>
                ) : (
                  <>
                    <span>📦</span>
                    下载源码包
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
