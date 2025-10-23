// assignment-detail.js
const storage = require('../../utils/storage')
const util = require('../../utils/util')

Page({
  data: {
    assignmentId: '',
    studentId: '',
    assignmentInfo: {},
    studentInfo: {},
    scoreRecord: null,
    loading: true,
    error: ''
  },

  onLoad(options) {
    if (options.assignmentId && options.studentId) {
      this.setData({
        assignmentId: options.assignmentId,
        studentId: options.studentId
      });
      this.loadData();
    } else {
      this.setData({
        error: '参数缺失',
        loading: false
      });
    }
  },

  // 加载数据
  loadData() {
    this.setData({ loading: true });
    
    try {
      // 获取作业信息
      const assignment = storage.getAssignmentById(this.data.assignmentId);
      if (!assignment) {
        this.setData({
          error: '作业不存在',
          loading: false
        });
        return;
      }

      // 获取学生信息
      const student = storage.getStudentById(this.data.studentId);
      if (!student) {
        this.setData({
          error: '学生不存在',
          loading: false
        });
        return;
      }

      // 获取成绩记录
      const scores = storage.getScoresByAssignmentId(this.data.assignmentId);
      const scoreRecord = scores.find(s => s.studentId === this.data.studentId);

      // 获取班级信息
      const studentClass = storage.getClassById(student.classId);

      this.setData({
        assignmentInfo: {
          ...assignment,
          createdAt: util.formatDate(new Date(assignment.createdAt)),
          updatedAt: assignment.updatedAt ? util.formatDate(new Date(assignment.updatedAt)) : null
        },
        studentInfo: {
          ...student,
          className: studentClass ? studentClass.name : '未知班级'
        },
        scoreRecord: scoreRecord || null,
        loading: false,
        error: ''
      });

    } catch (error) {
      console.error('加载数据失败:', error);
      this.setData({
        error: '加载数据失败',
        loading: false
      });
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 编辑成绩
  editScore() {
    wx.navigateTo({
      url: `/pages/score-entry/score-entry?assignmentId=${this.data.assignmentId}&studentId=${this.data.studentId}`
    });
  },

  onReady() {
    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: '作业详情'
    });
  },

  onShow() {
    // 页面显示时重新加载数据，以防成绩被修改
    if (this.data.assignmentId && this.data.studentId) {
      this.loadData();
    }
  },

  onHide() {

  },

  onUnload() {

  },

  onPullDownRefresh() {
    this.loadData();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {

  },

  onShareAppMessage() {
    return {
      title: `${this.data.studentInfo.name}的作业详情`,
      path: `/pages/assignment-detail/assignment-detail?assignmentId=${this.data.assignmentId}&studentId=${this.data.studentId}`
    };
  }
})