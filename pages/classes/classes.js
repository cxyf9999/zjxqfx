// classes.js
const storage = require('../../utils/storage')
const util = require('../../utils/util')

Page({
  data: {
    classes: [],
    currentClassId: '',
    showModal: false,
    isEdit: false,
    editingClassId: '',
    formData: {
      name: '',
      description: ''
    }
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  // 加载数据
  loadData() {
    const classes = storage.getClasses()
    const currentClassId = storage.getCurrentClassId()
    
    // 计算每个班级的统计信息
    const classesWithStats = classes.map(classItem => {
      const students = storage.getStudentsByClassId(classItem.id)
      const assignments = storage.getAssignmentsByClassId(classItem.id)
      
      return {
        ...classItem,
        studentCount: students.length,
        assignmentCount: assignments.length,
        createdAt: util.formatDate(new Date(classItem.createdAt))
      }
    })

    this.setData({
      classes: classesWithStats,
      currentClassId
    })
  },

  // 显示新建弹窗
  showAddModal() {
    this.setData({
      showModal: true,
      isEdit: false,
      editingClassId: '',
      formData: {
        name: '',
        description: ''
      }
    })
  },

  // 隐藏弹窗
  hideModal() {
    this.setData({
      showModal: false,
      isEdit: false,
      editingClassId: '',
      formData: {
        name: '',
        description: ''
      }
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

  // 提交表单
  handleSubmit(e) {
    const { name, description } = this.data.formData
    
    if (!name.trim()) {
      util.showError('请输入班级名称')
      return
    }

    if (this.data.isEdit) {
      this.updateClass(name.trim(), description.trim())
    } else {
      this.createClass(name.trim(), description.trim())
    }
  },

  // 创建班级
  createClass(name, description) {
    const classes = storage.getClasses()
    
    // 检查班级名称是否重复
    if (classes.some(c => c.name === name)) {
      util.showError('班级名称已存在')
      return
    }

    const newClass = {
      id: storage.generateId(),
      name,
      description,
      createdAt: new Date().toISOString()
    }

    classes.push(newClass)
    
    if (storage.saveClasses(classes)) {
      util.showSuccess('班级创建成功')
      this.hideModal()
      this.loadData()
    } else {
      util.showError('创建失败')
    }
  },

  // 更新班级
  updateClass(name, description) {
    const classes = storage.getClasses()
    const classIndex = classes.findIndex(c => c.id === this.data.editingClassId)
    
    if (classIndex === -1) {
      util.showError('班级不存在')
      return
    }

    // 检查班级名称是否重复（排除自己）
    if (classes.some(c => c.name === name && c.id !== this.data.editingClassId)) {
      util.showError('班级名称已存在')
      return
    }

    classes[classIndex] = {
      ...classes[classIndex],
      name,
      description,
      updatedAt: new Date().toISOString()
    }

    if (storage.saveClasses(classes)) {
      util.showSuccess('班级更新成功')
      this.hideModal()
      this.loadData()
    } else {
      util.showError('更新失败')
    }
  },

  // 编辑班级
  editClass(e) {
    const classId = e.currentTarget.dataset.id
    const classItem = this.data.classes.find(c => c.id === classId)
    
    if (!classItem) {
      util.showError('班级不存在')
      return
    }

    this.setData({
      showModal: true,
      isEdit: true,
      editingClassId: classId,
      formData: {
        name: classItem.name,
        description: classItem.description || ''
      }
    })
  },

  // 删除班级
  async deleteClass(e) {
    const classId = e.currentTarget.dataset.id
    const classItem = this.data.classes.find(c => c.id === classId)
    
    if (!classItem) {
      util.showError('班级不存在')
      return
    }

    // 检查是否有学生或作业
    const students = storage.getStudentsByClassId(classId)
    const assignments = storage.getAssignmentsByClassId(classId)
    
    if (students.length > 0 || assignments.length > 0) {
      const confirmed = await util.showConfirm(
        `该班级还有${students.length}个学生和${assignments.length}个作业，删除后相关数据也会被删除，确定要删除吗？`,
        '确认删除'
      )
      
      if (!confirmed) return
    } else {
      const confirmed = await util.showConfirm(`确定要删除班级"${classItem.name}"吗？`)
      if (!confirmed) return
    }

    // 删除班级及相关数据
    this.performDelete(classId)
  },

  // 执行删除操作
  performDelete(classId) {
    const classes = storage.getClasses()
    const students = storage.getStudents()
    const assignments = storage.getAssignments()
    const scores = storage.getScores()

    // 删除班级
    const newClasses = classes.filter(c => c.id !== classId)
    
    // 删除该班级的学生
    const newStudents = students.filter(s => s.classId !== classId)
    
    // 删除该班级的作业
    const deletedAssignmentIds = assignments
      .filter(a => a.classId === classId)
      .map(a => a.id)
    const newAssignments = assignments.filter(a => a.classId !== classId)
    
    // 删除相关成绩
    const newScores = scores.filter(s => !deletedAssignmentIds.includes(s.assignmentId))

    // 保存数据
    if (storage.saveClasses(newClasses) && 
        storage.saveStudents(newStudents) && 
        storage.saveAssignments(newAssignments) && 
        storage.saveScores(newScores)) {
      
      // 如果删除的是当前班级，切换到第一个班级
      if (classId === this.data.currentClassId && newClasses.length > 0) {
        storage.setCurrentClassId(newClasses[0].id)
      }
      
      util.showSuccess('删除成功')
      this.loadData()
    } else {
      util.showError('删除失败')
    }
  },

  // 选择班级
  selectClass(e) {
    const classId = e.currentTarget.dataset.id
    const classItem = this.data.classes.find(c => c.id === classId)
    
    if (!classItem) return

    storage.setCurrentClassId(classId)
    
    this.setData({
      currentClassId: classId
    })

    util.showSuccess(`已切换到${classItem.name}`)
  }
})