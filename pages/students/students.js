// students.js
const storage = require('../../utils/storage')
const util = require('../../utils/util')

Page({
  data: {
    students: [],
    filteredStudents: [],
    currentClassId: '',
    currentClassName: '',
    searchKeyword: '',
    showModal: false,
    showImportModal: false,
    isEdit: false,
    editingStudentId: '',
    formData: {
      name: '',
      studentNumber: ''
    },
    importData: '',
    previewStudents: [],
    importErrors: []
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  // 加载数据
  loadData() {
    const currentClassId = storage.getCurrentClassId()
    const classes = storage.getClasses()
    const currentClass = classes.find(c => c.id === currentClassId)
    
    if (!currentClass) {
      util.showError('请先选择班级')
      wx.switchTab({
        url: '/pages/classes/classes'
      })
      return
    }

    const students = storage.getStudentsByClassId(currentClassId)
    
    // 计算每个学生的统计信息
    const studentsWithStats = students.map(student => {
      const scores = storage.getScoresByStudentId(student.id)
      
      return {
        ...student,
        createdAt: util.formatDate(new Date(student.createdAt)),
        stats: {
          gradedCount: scores.length
        }
      }
    })

    // 按创建时间倒序排列
    studentsWithStats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    this.setData({
      students: studentsWithStats,
      filteredStudents: studentsWithStats,
      currentClassId,
      currentClassName: currentClass.name
    })
  },

  // 搜索输入
  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({
      searchKeyword: keyword
    })
    
    // 实时搜索
    this.filterStudents(keyword)
  },

  // 搜索确认
  onSearch() {
    this.filterStudents(this.data.searchKeyword)
  },

  // 过滤学生
  filterStudents(keyword) {
    if (!keyword.trim()) {
      this.setData({
        filteredStudents: this.data.students
      })
      return
    }

    const filtered = this.data.students.filter(student => {
      const nameMatch = student.name.toLowerCase().includes(keyword.toLowerCase())
      const numberMatch = student.studentNumber && student.studentNumber.toLowerCase().includes(keyword.toLowerCase())
      return nameMatch || numberMatch
    })

    this.setData({
      filteredStudents: filtered
    })
  },

  // 显示新建弹窗
  showAddModal() {
    this.setData({
      showModal: true,
      isEdit: false,
      editingStudentId: '',
      formData: {
        name: '',
        studentNumber: ''
      }
    })
  },

  // 隐藏弹窗
  hideModal() {
    this.setData({
      showModal: false,
      isEdit: false,
      editingStudentId: '',
      formData: {
        name: '',
        studentNumber: ''
      }
    })
  },

  // 显示导入弹窗
  showImportModal() {
    this.setData({
      showImportModal: true,
      importData: '',
      previewStudents: [],
      importErrors: []
    })
  },

  // 隐藏导入弹窗
  hideImportModal() {
    this.setData({
      showImportModal: false,
      importData: '',
      previewStudents: [],
      importErrors: []
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 阻止点击模态框内容时关闭弹窗
  },

  // 输入框变化
  onInputChange(e) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`formData.${field}`]: value
    })
  },

  // 导入数据变化
  onImportDataChange(e) {
    const importData = e.detail.value
    this.setData({
      importData
    })
    
    // 解析导入数据
    this.parseImportData(importData)
  },

  // 解析导入数据
  parseImportData(importData) {
    if (!importData.trim()) {
      this.setData({
        previewStudents: [],
        importErrors: []
      })
      return
    }

    const lines = importData.trim().split('\n')
    const previewStudents = []
    const importErrors = []
    const existingNames = new Set()
    const existingNumbers = new Set()

    // 获取现有学生数据用于重复检查
    this.data.students.forEach(student => {
      existingNames.add(student.name)
      if (student.studentNumber) {
        existingNumbers.add(student.studentNumber)
      }
    })

    lines.forEach((line, index) => {
      const lineNumber = index + 1
      const trimmedLine = line.trim()
      
      if (!trimmedLine) return

      const parts = trimmedLine.split(',').map(part => part.trim())
      
      if (parts.length === 0 || !parts[0]) {
        importErrors.push({
          line: lineNumber,
          message: '姓名不能为空'
        })
        return
      }

      const name = parts[0]
      const studentNumber = parts[1] || ''

      // 验证姓名
      if (name.length < 2 || name.length > 20) {
        importErrors.push({
          line: lineNumber,
          message: '姓名长度应在2-20个字符之间'
        })
        return
      }

      // 检查姓名重复
      if (existingNames.has(name)) {
        importErrors.push({
          line: lineNumber,
          message: `姓名"${name}"已存在`
        })
        return
      }

      // 检查学号重复
      if (studentNumber && existingNumbers.has(studentNumber)) {
        importErrors.push({
          line: lineNumber,
          message: `学号"${studentNumber}"已存在`
        })
        return
      }

      // 检查本次导入中的重复
      if (previewStudents.some(s => s.name === name)) {
        importErrors.push({
          line: lineNumber,
          message: `姓名"${name}"在导入数据中重复`
        })
        return
      }

      if (studentNumber && previewStudents.some(s => s.studentNumber === studentNumber)) {
        importErrors.push({
          line: lineNumber,
          message: `学号"${studentNumber}"在导入数据中重复`
        })
        return
      }

      // 添加到预览列表
      previewStudents.push({
        name,
        studentNumber
      })
      
      // 添加到临时集合中用于重复检查
      existingNames.add(name)
      if (studentNumber) {
        existingNumbers.add(studentNumber)
      }
    })

    this.setData({
      previewStudents,
      importErrors
    })
  },

  // 提交表单
  handleSubmit() {
    const { name, studentNumber } = this.data.formData
    
    if (!name.trim()) {
      util.showError('请输入学生姓名')
      return
    }

    if (name.trim().length < 2 || name.trim().length > 20) {
      util.showError('姓名长度应在2-20个字符之间')
      return
    }

    if (this.data.isEdit) {
      this.updateStudent(name.trim(), studentNumber.trim())
    } else {
      this.createStudent(name.trim(), studentNumber.trim())
    }
  },

  // 创建学生
  createStudent(name, studentNumber) {
    const students = storage.getStudents()
    
    // 检查姓名是否重复（同班级内）
    if (students.some(s => s.name === name && s.classId === this.data.currentClassId)) {
      util.showError('学生姓名已存在')
      return
    }

    // 检查学号是否重复（全局）
    if (studentNumber && students.some(s => s.studentNumber === studentNumber)) {
      util.showError('学号已存在')
      return
    }

    const newStudent = {
      id: storage.generateId(),
      classId: this.data.currentClassId,
      name,
      studentNumber: studentNumber || '',
      createdAt: new Date().toISOString()
    }

    students.push(newStudent)
    
    if (storage.saveStudents(students)) {
      util.showSuccess('学生创建成功')
      this.hideModal()
      this.loadData()
    } else {
      util.showError('创建失败')
    }
  },

  // 更新学生
  updateStudent(name, studentNumber) {
    const students = storage.getStudents()
    const studentIndex = students.findIndex(s => s.id === this.data.editingStudentId)
    
    if (studentIndex === -1) {
      util.showError('学生不存在')
      return
    }

    // 检查姓名是否重复（排除自己）
    if (students.some(s => s.name === name && s.classId === this.data.currentClassId && s.id !== this.data.editingStudentId)) {
      util.showError('学生姓名已存在')
      return
    }

    // 检查学号是否重复（排除自己）
    if (studentNumber && students.some(s => s.studentNumber === studentNumber && s.id !== this.data.editingStudentId)) {
      util.showError('学号已存在')
      return
    }

    students[studentIndex] = {
      ...students[studentIndex],
      name,
      studentNumber: studentNumber || '',
      updatedAt: new Date().toISOString()
    }

    if (storage.saveStudents(students)) {
      util.showSuccess('学生更新成功')
      this.hideModal()
      this.loadData()
    } else {
      util.showError('更新失败')
    }
  },

  // 批量导入
  handleImport() {
    if (this.data.previewStudents.length === 0) {
      util.showError('没有可导入的学生')
      return
    }

    const students = storage.getStudents()
    const newStudents = this.data.previewStudents.map(student => ({
      id: storage.generateId(),
      classId: this.data.currentClassId,
      name: student.name,
      studentNumber: student.studentNumber || '',
      createdAt: new Date().toISOString()
    }))

    students.push(...newStudents)
    
    if (storage.saveStudents(students)) {
      util.showSuccess(`成功导入${newStudents.length}个学生`)
      this.hideImportModal()
      this.loadData()
    } else {
      util.showError('导入失败')
    }
  },

  // 编辑学生
  editStudent(e) {
    const studentId = e.currentTarget.dataset.id
    const student = this.data.students.find(s => s.id === studentId)
    
    if (!student) {
      util.showError('学生不存在')
      return
    }

    this.setData({
      showModal: true,
      isEdit: true,
      editingStudentId: studentId,
      formData: {
        name: student.name,
        studentNumber: student.studentNumber || ''
      }
    })
  },

  // 删除学生
  async deleteStudent(e) {
    const studentId = e.currentTarget.dataset.id
    const student = this.data.students.find(s => s.id === studentId)
    
    if (!student) {
      util.showError('学生不存在')
      return
    }

    // 检查是否有成绩记录
    const scores = storage.getScoresByStudentId(studentId)
    
    if (scores.length > 0) {
      const confirmed = await util.showConfirm(
        `该学生还有${scores.length}条成绩记录，删除后相关数据也会被删除，确定要删除吗？`,
        '确认删除'
      )
      
      if (!confirmed) return
    } else {
      const confirmed = await util.showConfirm(`确定要删除学生"${student.name}"吗？`)
      if (!confirmed) return
    }

    // 删除学生及相关成绩
    this.performDelete(studentId)
  },

  // 执行删除操作
  performDelete(studentId) {
    const students = storage.getStudents()
    const scores = storage.getScores()

    // 删除学生
    const newStudents = students.filter(s => s.id !== studentId)
    
    // 删除相关成绩
    const newScores = scores.filter(s => s.studentId !== studentId)

    // 保存数据
    if (storage.saveStudents(newStudents) && storage.saveScores(newScores)) {
      util.showSuccess('删除成功')
      this.loadData()
    } else {
      util.showError('删除失败')
    }
  },

  // 查看学生成绩
  viewStudentScores(e) {
    const studentId = e.currentTarget.dataset.id
    
    wx.navigateTo({
      url: `/pages/student-scores/student-scores?studentId=${studentId}`
    })
  }
})