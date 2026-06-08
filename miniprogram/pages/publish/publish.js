const db = wx.cloud.database()
const app = getApp()

Page({
  data: {
    content: '',
    anonymousName: ''
  },

  onLoad() {
    this.generateAnonymousName()
  },

  generateAnonymousName() {
    const name = app.globalData.generateAnonymousName()
    this.setData({ anonymousName: name })
  },

  handleInput(e) {
    this.setData({ content: e.detail.value })
  },

  refreshName() {
    this.generateAnonymousName()
  },

  handlePublish() {
    const { content, anonymousName } = this.data
    
    if (!content.trim()) {
      wx.showToast({ title: '请输入留言内容', icon: 'none' })
      return
    }

    wx.showLoading({ title: '发布中...' })

    const newMessage = {
      content: content.trim(),
      anonymousName,
      likeCount: 0,
      createTime: Date.now(),
      userId: app.globalData.getUserId()
    }

    db.collection('treehole_messages').add({
      data: newMessage
    }).then(() => {
      wx.hideLoading()
      wx.showToast({ title: '发布成功', icon: 'success' })
      this.setData({ content: '' })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' })
      }, 1500)
    }).catch(err => {
      wx.hideLoading()
      console.error('发布失败:', err)
      // 显示更详细的错误信息
      const errMsg = err.errMsg || err.message || '未知错误'
      const errCode = err.errCode !== undefined ? `（错误码：${err.errCode}）` : ''
      wx.showModal({
        title: '发布失败',
        content: `${errMsg}${errCode}\n\n请检查：\n1. 是否在 app.js 中配置了正确的云开发环境ID\n2. 是否在云开发控制台创建了 treehole_messages 集合\n3. 网络是否正常`,
        showCancel: false,
        confirmText: '我知道了'
      })
    })
  }
})