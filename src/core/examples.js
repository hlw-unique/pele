// Examples shown in the workbench. They are ordinary Mermaid sources; Pele detects the type.
export const EXAMPLES = Object.freeze([
  {
    id: 'flowchart',
    label: '流程图 · 登录判断',
    type: 'flowchart',
    code: `flowchart LR
  A([开始]) --> B{是否已登录?}
  B -- 是 --> C[加载数据]
  B -- 否 --> D[跳转登录]
  C --> E[(数据库)]
  D --> A

  subgraph 缓存
    C --> F[Redis]
  end`,
  },
  {
    id: 'sequence',
    label: '时序图 · 登录流程',
    type: 'sequence',
    code: `sequenceDiagram
  autonumber
  actor 用户
  participant 前端
  participant 服务端
  participant 数据库

  用户->>前端: 提交登录
  前端->>服务端: POST /login
  服务端->>数据库: 查询用户
  数据库-->>服务端: 用户信息
  服务端-->>前端: 返回 JWT
  前端-->>用户: 登录成功`,
  },
  {
    id: 'class',
    label: '类图 · 订单模型',
    type: 'class',
    code: `classDiagram
  class User {
    +String name
    +String email
    +login()
  }

  class Order {
    +String id
    +Number total
    +pay()
  }

  class Payment {
    +String method
    +refund()
  }

  User "1" --> "*" Order : 下单
  Order "1" --> "0..1" Payment : 支付`,
  },
  {
    id: 'state',
    label: '状态图 · 订单状态',
    type: 'state',
    code: `stateDiagram-v2
  [*] --> 待支付
  待支付 --> 已支付: 支付成功
  待支付 --> 已取消: 超时
  已支付 --> 已发货: 出库
  已发货 --> 已完成: 签收
  已取消 --> [*]
  已完成 --> [*]`,
  },
  {
    id: 'pie',
    label: '饼图 · 流量来源',
    type: 'pie',
    code: `pie showData
  title 流量来源
  "自然搜索" : 42
  "直接访问" : 28
  "社交媒体" : 18
  "推荐链接" : 12`,
  },
  {
    id: 'xychart',
    label: 'XY 图 · 月度访问量',
    type: 'xychart',
    code: `xychart
  title "月度访问量"
  x-axis ["一月", "二月", "三月", "四月", "五月", "六月"]
  y-axis "访问量" 0 --> 1000
  bar [320, 480, 610, 750, 880, 960]
  line [280, 420, 560, 700, 840, 920]`,
  },
  {
    id: 'mindmap',
    label: '思维导图 · 产品规划',
    type: 'mindmap',
    code: `mindmap
  root((产品规划))
    用户研究
      用户访谈
      需求问卷
    功能设计
      账号体系
      支付流程
    发布上线
      灰度发布
      全量开放`,
  },
  {
    id: 'gantt',
    label: '甘特图 · 项目排期',
    type: 'gantt',
    code: `gantt
  title 项目排期
  dateFormat YYYY-MM-DD
  axisFormat %m/%d

  section 设计
    需求梳理 :done, a1, 2025-01-06, 5d
    视觉设计 :active, a2, after a1, 7d

  section 开发
    前端开发 :a3, after a2, 10d
    后端开发 :a4, after a2, 12d

  section 测试
    联调测试 :a5, after a4, 5d`,
  },
  {
    id: 'timeline',
    label: '时间线 · 产品演进',
    type: 'timeline',
    code: `timeline
  title 产品演进
  section 2023
    第一版 : 核心流程上线
  section 2024
    第二版 : 支持多人协作
  section 2025
    第三版 : 引入 AI 辅助`,
  },
]);

export const DEFAULT_EXAMPLE = EXAMPLES[0];
