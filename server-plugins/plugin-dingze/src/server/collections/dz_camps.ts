import { defineCollection } from '@nocobase/database';

// 训练营批次 (闭环第三批)：运营侧的组织单位——同一期训练营的企业、日期和现场节奏。企业侧看不到批次，
// 项目只多一个 campId；结营后项目可以转为企业内训继续做。
export default defineCollection({
  name: 'dz_camps',
  title: '训练营批次',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'string', name: 'name', allowNull: false },
    { type: 'string', name: 'startDate' },
    { type: 'string', name: 'endDate' },
    { type: 'string', name: 'location' },
    // planning 筹备中 / running 进行中 / closed 已结营
    { type: 'string', name: 'status', defaultValue: 'planning' },
    // 今日目标表：现场看板按这几张表看各企业进度
    { type: 'json', name: 'focusCodes', defaultValue: [] },
    { type: 'text', name: 'note' },
    { type: 'hasMany', name: 'projects', target: 'dz_projects', foreignKey: 'campId' },
  ],
});
