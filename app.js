// app.js
App({
  onLaunch() {
    // 小程序启动时执行
    
    // 初始化数据
    this.initializeData()
    
    // 初始化用户信息
    this.initializeUserInfo()
  },

  onShow() {
    // 小程序显示时执行
  },

  onHide() {
    // 小程序隐藏时执行
  },

  // 初始化数据
  initializeData() {
    try {
      // 检查是否有现有数据
      const assignments = wx.getStorageSync('assignments') || []
      const students = wx.getStorageSync('students') || []
      const classes = wx.getStorageSync('classes') || []
      const scores = wx.getStorageSync('scores') || []
      
      // 如果没有班级数据，创建默认班级
      if (classes.length === 0) {
        const defaultClass = {
          id: 'default-class',
          name: '默认班级',
          description: '系统默认班级',
          createdAt: new Date().toISOString()
        }
        wx.setStorageSync('classes', [defaultClass])
        wx.setStorageSync('currentClassId', 'default-class')
      }

      // 兼容性处理：为没有classId的现有数据分配默认班级
      this.migrateOldData(assignments, students)
      
    } catch (error) {
      console.error('初始化数据失败:', error)
    }
  },

  // 迁移旧数据
  migrateOldData(assignments, students) {
    const defaultClassId = 'default-class'
    let needSave = false

    // 处理学生数据
    students.forEach(student => {
      if (!student.classId) {
        student.classId = defaultClassId
        needSave = true
      }
    })

    // 处理作业数据
    assignments.forEach(assignment => {
      if (!assignment.classId) {
        assignment.classId = defaultClassId
        needSave = true
      }
    })

    if (needSave) {
      wx.setStorageSync('students', students)
      wx.setStorageSync('assignments', assignments)
    }
  },

  // 初始化用户信息
  initializeUserInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo')
      if (userInfo) {
        this.globalData.userInfo = userInfo
      }
    } catch (error) {
      console.error('加载用户信息失败:', error)
    }
  },

  // 设置用户信息
  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo
    try {
      wx.setStorageSync('userInfo', userInfo)
    } catch (error) {
      console.error('保存用户信息失败:', error)
    }
  },

  // 清除用户信息
  clearUserInfo() {
    this.globalData.userInfo = null
    try {
      wx.removeStorageSync('userInfo')
    } catch (error) {
      console.error('清除用户信息失败:', error)
    }
  },

  // 全局数据
  globalData: {
    userInfo: null,
    currentClassId: null
  }
})