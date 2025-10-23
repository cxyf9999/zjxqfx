// storage.js - 数据存储工具函数

/**
 * 生成唯一ID
 */
function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9)
}

/**
 * 获取所有班级
 */
function getClasses() {
  try {
    return wx.getStorageSync('classes') || []
  } catch (error) {
    console.error('获取班级数据失败:', error)
    return []
  }
}

/**
 * 保存班级数据
 */
function saveClasses(classes) {
  try {
    wx.setStorageSync('classes', classes)
    return true
  } catch (error) {
    console.error('保存班级数据失败:', error)
    return false
  }
}

/**
 * 获取所有作业
 */
function getAssignments() {
  try {
    return wx.getStorageSync('assignments') || []
  } catch (error) {
    console.error('获取作业数据失败:', error)
    return []
  }
}

/**
 * 保存作业数据
 */
function saveAssignments(assignments) {
  try {
    wx.setStorageSync('assignments', assignments)
    return true
  } catch (error) {
    console.error('保存作业数据失败:', error)
    return false
  }
}

/**
 * 获取所有学生
 */
function getStudents() {
  try {
    return wx.getStorageSync('students') || []
  } catch (error) {
    console.error('获取学生数据失败:', error)
    return []
  }
}

/**
 * 保存学生数据
 */
function saveStudents(students) {
  try {
    wx.setStorageSync('students', students)
    return true
  } catch (error) {
    console.error('保存学生数据失败:', error)
    return false
  }
}

/**
 * 获取所有成绩
 */
function getScores() {
  try {
    return wx.getStorageSync('scores') || []
  } catch (error) {
    console.error('获取成绩数据失败:', error)
    return []
  }
}

/**
 * 保存成绩数据
 */
function saveScores(scores) {
  try {
    wx.setStorageSync('scores', scores)
    return true
  } catch (error) {
    console.error('保存成绩数据失败:', error)
    return false
  }
}

/**
 * 获取当前班级ID
 */
function getCurrentClassId() {
  try {
    return wx.getStorageSync('currentClassId') || ''
  } catch (error) {
    console.error('获取当前班级ID失败:', error)
    return ''
  }
}

/**
 * 设置当前班级ID
 */
function setCurrentClassId(classId) {
  try {
    wx.setStorageSync('currentClassId', classId)
    return true
  } catch (error) {
    console.error('设置当前班级ID失败:', error)
    return false
  }
}

/**
 * 根据班级ID获取班级信息
 */
function getClassById(classId) {
  const classes = getClasses()
  return classes.find(c => c.id === classId) || null
}

/**
 * 根据班级ID获取该班级的作业
 */
function getAssignmentsByClassId(classId) {
  const assignments = getAssignments()
  return assignments.filter(a => a.classId === classId)
}

/**
 * 根据班级ID获取该班级的学生
 */
function getStudentsByClassId(classId) {
  const students = getStudents()
  return students.filter(s => s.classId === classId)
}

/**
 * 根据作业ID和学生ID获取成绩
 */
function getScoreByIds(assignmentId, studentId) {
  const scores = getScores()
  return scores.find(score => score.assignmentId === assignmentId && score.studentId === studentId)
}

/**
 * 根据作业ID获取所有成绩
 */
function getScoresByAssignmentId(assignmentId) {
  const scores = getScores()
  return scores.filter(score => score.assignmentId === assignmentId)
}

/**
 * 根据学生ID获取所有成绩
 */
function getScoresByStudentId(studentId) {
  const scores = getScores()
  return scores.filter(score => score.studentId === studentId)
}

/**
 * 根据ID获取作业
 */
function getAssignmentById(assignmentId) {
  const assignments = getAssignments()
  return assignments.find(assignment => assignment.id === assignmentId)
}

/**
 * 根据ID获取学生
 */
function getStudentById(studentId) {
  const students = getStudents()
  return students.find(student => student.id === studentId)
}

/**
 * 保存所有数据
 */
function saveAllData() {
  try {
    // 这里可以添加数据验证逻辑
    return true
  } catch (error) {
    console.error('保存数据失败:', error)
    return false
  }
}

/**
 * 清除所有数据
 */
function clearAllData() {
  try {
    wx.clearStorageSync()
    return true
  } catch (error) {
    console.error('清除数据失败:', error)
    return false
  }
}

/**
 * 通用获取数据方法
 */
function getItem(key) {
  try {
    return wx.getStorageSync(key)
  } catch (error) {
    console.error('获取数据失败:', error)
    return null
  }
}

/**
 * 通用保存数据方法
 */
function setItem(key, value) {
  try {
    wx.setStorageSync(key, value)
    return true
  } catch (error) {
    console.error('保存数据失败:', error)
    return false
  }
}

module.exports = {
  generateId,
  getClasses,
  saveClasses,
  getAssignments,
  saveAssignments,
  getStudents,
  saveStudents,
  getScores,
  saveScores,
  getCurrentClassId,
  setCurrentClassId,
  getClassById,
  getAssignmentsByClassId,
  getStudentsByClassId,
  getScoreByIds,
  getScoresByAssignmentId,
  getScoresByStudentId,
  getAssignmentById,
  getStudentById,
  saveAllData,
  clearAllData,
  getItem,
  setItem
}