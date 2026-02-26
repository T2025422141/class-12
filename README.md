# 🏫 班级签到系统

一个基于 **Next.js 16 + React 19 + TypeScript** 的全栈班级管理与签到应用。

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?style=flat-square&logo=tailwind-css)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## ✨ 功能特性

- 📋 **多班级管理** - 支持创建多个独立班级，数据隔离
- 📍 **GPS 定位签到** - 支持位置验证，可设置签到距离限制
- 📝 **多种签到状态** - 正常出勤、迟到、请假、赣青二课、其他
- 🏖️ **请假管理** - 支持日期范围请假和固定星期请假
- 🔐 **管理后台** - 密码保护的管理功能
- 📊 **数据导出** - 支持 Excel 格式导出签到记录
- ☁️ **云端存储** - Supabase 数据库 + S3 对象存储
- 📱 **移动端适配** - 响应式设计，支持手机浏览器

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 前端 | React 19, TypeScript 5 |
| 样式 | Tailwind CSS 4 |
| UI 组件 | shadcn/ui (Radix UI) |
| 数据库 | Supabase (PostgreSQL) |
| 对象存储 | S3 兼容存储 |
| 部署 | Vercel |

## 📁 项目结构

```
src/
├── app/
│   ├── page.tsx                 # 首页
│   ├── layout.tsx               # 根布局
│   ├── globals.css              # 全局样式
│   ├── class/[id]/
│   │   ├── page.tsx             # 签到页面
│   │   └── admin/page.tsx       # 管理后台
│   └── api/
│       ├── class/
│       │   ├── route.ts         # 班级 CRUD
│       │   ├── checkin/         # 签到记录
│       │   ├── members/         # 成员管理
│       │   ├── settings/        # 签到设置
│       │   └── leave/           # 请假记录
│       ├── upload/              # 文件上传
│       └── export/              # 数据导出
├── components/ui/               # UI 组件库
└── storage/database/            # 数据库客户端
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm 9+

### 本地开发

```bash
# 克隆项目
git clone <your-repo-url>
cd class-checkin-system

# 安装依赖
pnpm install

# 复制环境变量配置
cp .env.example .env.local

# 编辑 .env.local 填写实际配置
# ...

# 启动开发服务器
pnpm dev
```

访问 http://localhost:3000 查看应用。

## 📦 部署到 Vercel

### 方式一：一键部署（推荐）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/class-checkin-system)

### 方式二：手动部署

#### 步骤 1：准备 Supabase 数据库

1. 访问 [Supabase](https://supabase.com) 创建免费项目
2. 在 SQL Editor 中执行建表语句（见 `.env.example`）
3. 获取项目 URL 和 Anon Key

#### 步骤 2：准备 S3 存储

选择任一 S3 兼容服务：

| 服务 | 说明 |
|------|------|
| AWS S3 | 国际首选 |
| 阿里云 OSS | 国内推荐 |
| 腾讯云 COS | 国内备选 |
| Supabase Storage | 与数据库集成 |

#### 步骤 3：部署到 Vercel

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel
```

#### 步骤 4：配置环境变量

在 Vercel Dashboard 中添加以下环境变量：

```
COZE_SUPABASE_URL=https://xxx.supabase.co
COZE_SUPABASE_ANON_KEY=eyJxxx...
COZE_BUCKET_ENDPOINT_URL=https://oss-cn-xxx.aliyuncs.com
COZE_BUCKET_NAME=your-bucket
```

#### 步骤 5：重新部署

配置环境变量后，触发重新部署即可。

### Vercel 配置文件说明

项目根目录的 `vercel.json` 已配置：

```json
{
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "regions": ["hkg1", "sin1"],
  "functions": {
    "src/app/api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 30
    }
  }
}
```

- **regions**: 部署区域（香港、新加坡，适合国内访问）
- **functions.memory**: API 函数内存配置
- **functions.maxDuration**: API 超时时间（秒）

## 🔧 环境变量说明

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `COZE_SUPABASE_URL` | ✅ | Supabase 项目 URL |
| `COZE_SUPABASE_ANON_KEY` | ✅ | Supabase 匿名密钥 |
| `COZE_BUCKET_ENDPOINT_URL` | ✅ | S3 存储端点 URL |
| `COZE_BUCKET_NAME` | ✅ | S3 存储桶名称 |

## 📖 使用指南

### 创建班级

1. 访问首页，点击「创建班级」
2. 填写班级名称、描述、管理员密码
3. 创建成功后自动跳转到班级页面

### 管理班级

1. 在班级页面点击右上角「管理」
2. 输入管理员密码进入后台
3. 可进行以下操作：
   - 📝 导入成员名单
   ⚙️ 设置签到时间
   📍 设置签到位置
   🗑️ 清除签到记录
   📊 导出签到数据

### 签到流程

1. 用户访问班级链接
2. 选择姓名和签到状态
3. 如选择「正常出勤」且班级设置了位置：
   - 自动获取 GPS 位置
   - 验证是否在签到范围内
4. 提交签到

## 🔒 安全说明

- 管理后台通过密码保护
- 签到位置使用本地 GPS 计算，不调用第三方 API
- 敏感数据存储在 Supabase，支持行级安全策略

## 📄 许可证

[MIT License](LICENSE)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！**
