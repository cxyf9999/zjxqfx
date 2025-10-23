// index.js
const app = getApp()

Page({
  data: {
    classCount: 0,
    assignmentCount: 0,
    studentCount: 0,
    currentClassId: '',
    currentClassName: '未选择班级',
    currentClassDesc: '',
    recentAssignments: [],
    classes: [],
    showClassModal: false
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  // 加载数据
  loadData() {
    try {
      const classes = wx.getStorageSync('classes') || []
      const assignments = wx.getStorageSync('assignments') || []
      const students = wx.getStorageSync('students') || []
      const currentClassId = wx.getStorageSync('currentClassId') || ''

      // 获取当前班级信息
      const currentClass = classes.find(c => c.id === currentClassId) || {}
      
      // 获取当前班级的作业和学生
      const currentAssignments = assignments.filter(a => a.classId === currentClassId)
      const currentStudents = students.filter(s => s.classId === currentClassId)
      
      // 获取最近的3个作业
      const recentAssignments = currentAssignments
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 3)
        .map(assignment => ({
          ...assignment,
          createdAt: this.formatDate(assignment.createdAt)
        }))

      this.setData({
        classCount: classes.length,
        assignmentCount: currentAssignments.length,
        studentCount: currentStudents.length,
        currentClassId,
        currentClassName: currentClass.name || '未选择班级',
        currentClassDesc: currentClass.description || '',
        recentAssignments,
        classes
      })

      // 更新全局数据
      app.globalData.currentClassId = currentClassId

    } catch (error) {
      console.error('加载数据失败:', error)
      wx.showToast({
        title: '加载数据失败',
        icon: 'error'
      })
    }
  },

  // 格式化日期
  formatDate(dateString) {
    const date = new Date(dateString)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${month}-${day}`
  },

  // 切换班级
  switchClass() {
    this.setData({
      showClassModal: true
    })
  },

  // 隐藏班级选择弹窗
  hideClassModal() {
    this.setData({
      showClassModal: false
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 阻止点击模态框内容时关闭弹窗
  },

  // 选择班级
  selectClass(e) {
    const classId = e.currentTarget.dataset.id
    const selectedClass = this.data.classes.find(c => c.id === classId)
    
    if (selectedClass) {
      wx.setStorageSync('currentClassId', classId)
      
      this.setData({
        currentClassId: classId,
        currentClassName: selectedClass.name,
        currentClassDesc: selectedClass.description,
        showClassModal: false
      })

      // 重新加载数据
      this.loadData()

      wx.showToast({
        title: `已切换到${selectedClass.name}`,
        icon: 'success'
      })
    }
  },

  // 跳转到作业管理
  goToAssignments() {
    wx.navigateTo({
      url: '/pages/assignments/assignments'
    })
  },

  // 跳转到学生管理
  goToStudents() {
    wx.navigateTo({
      url: '/pages/students/students'
    })
  },

  // 跳转到班级管理
  goToClasses() {
    wx.navigateTo({
      url: '/pages/classes/classes'
    })
  },

  // 创建新作业
  createAssignment() {
    if (!this.data.currentClassId) {
      wx.showModal({
        title: '提示',
        content: '请先选择班级',
        showCancel: false
      })
      return
    }

    wx.navigateTo({
      url: '/pages/assignments/assignments?action=create'
    })
  },

  // 查看作业详情
  viewAssignment(e) {
    const assignmentId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/score-view/score-view?assignmentId=${assignmentId}`
    })
  }
})